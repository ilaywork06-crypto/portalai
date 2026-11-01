import base64
import hashlib
import secrets
import time
from collections.abc import Iterator
from typing import Any
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI

from portal_auth.infrastructure.orm import Base
from portal_auth.infrastructure.persistence import AuthUnitOfWork
from portal_auth.infrastructure.seed import seed_demo_users
from portal_auth.main import create_app, identity_provider
from portal_auth.settings import AuthSettings
from portal_kit.testing import TEST_DATABASE_URL, TEST_SECRET, ApiClient, api_client, create_schema

API = "/AI/api/auth"
ISSUER = "https://idp.example/realms/portal"
CLIENT_ID = "portal-ai"
CLIENT_SECRET = "s3cret:with/odd chars"
CALLBACK = "http://localhost:8080/AI/api/auth/sso/callback"


class FakeIdp:
    """A minimal OpenID Provider: discovery, JWKS, and a token endpoint that enforces PKCE and client auth."""

    def __init__(self) -> None:
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.kid = "k1"
        self.grants: dict[str, dict[str, str]] = {}
        self.overrides: dict[str, Any] = {}
        self.forged_with: rsa.RSAPrivateKey | None = None

    def sign_in(self, authorize_url: str, username: str = "Alon.Cohen@corp.example") -> tuple[str, str]:
        query = {k: v[0] for k, v in parse_qs(urlsplit(authorize_url).query).items()}
        assert (
            query["client_id"] == CLIENT_ID
            and query["redirect_uri"] == CALLBACK
            and query["code_challenge_method"] == "S256"
        )
        code = secrets.token_urlsafe(8)
        self.grants[code] = {"nonce": query["nonce"], "challenge": query["code_challenge"], "username": username}
        return code, query["state"]

    def rotate_key(self) -> None:
        self.key, self.kid = rsa.generate_private_key(public_exponent=65537, key_size=2048), "k2"

    def handle(self, request: httpx.Request) -> httpx.Response:
        match request.url.path:
            case "/realms/portal/.well-known/openid-configuration":
                return httpx.Response(
                    200,
                    json={
                        "issuer": ISSUER,
                        "authorization_endpoint": f"{ISSUER}/protocol/openid-connect/auth",
                        "token_endpoint": f"{ISSUER}/protocol/openid-connect/token",
                        "jwks_uri": f"{ISSUER}/protocol/openid-connect/certs",
                        "id_token_signing_alg_values_supported": ["RS256", "HS256"],
                    },
                )
            case "/realms/portal/protocol/openid-connect/certs":
                jwk = jwt.algorithms.RSAAlgorithm.to_jwk(self.key.public_key(), as_dict=True)
                return httpx.Response(200, json={"keys": [jwk | {"kid": self.kid, "use": "sig", "alg": "RS256"}]})
            case "/realms/portal/protocol/openid-connect/token":
                return self._token(request)
        return httpx.Response(404)

    def _token(self, request: httpx.Request) -> httpx.Response:
        expected = base64.b64encode(
            f"{CLIENT_ID}:{CLIENT_SECRET.replace(':', '%3A').replace('/', '%2F').replace(' ', '%20')}".encode()
        ).decode()
        if request.headers.get("authorization") != f"Basic {expected}":
            return httpx.Response(401, json={"error": "invalid_client"})
        form = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
        grant = self.grants.pop(form["code"], None)
        verifier_hash = (
            base64.urlsafe_b64encode(hashlib.sha256(form["code_verifier"].encode()).digest()).rstrip(b"=").decode()
        )
        if grant is None or verifier_hash != grant["challenge"] or form["redirect_uri"] != CALLBACK:
            return httpx.Response(400, json={"error": "invalid_grant"})
        now = int(time.time())
        claims = {
            "iss": ISSUER,
            "aud": CLIENT_ID,
            "sub": "abc",
            "iat": now,
            "exp": now + 300,
            "nonce": grant["nonce"],
            "preferred_username": grant["username"],
        }
        token = jwt.encode(
            claims | self.overrides, self.forged_with or self.key, algorithm="RS256", headers={"kid": self.kid}
        )
        return httpx.Response(200, json={"access_token": "x", "token_type": "Bearer", "id_token": token})


@pytest.fixture
def idp() -> FakeIdp:
    return FakeIdp()


def _settings(**overrides: Any) -> AuthSettings:
    values: dict[str, Any] = {
        "database_url": TEST_DATABASE_URL,
        "jwt_secret": TEST_SECRET,
        "environment": "test",
        "cookie_secure": False,
    }
    return AuthSettings(**(values | overrides))


def _client(settings: AuthSettings, idp: FakeIdp | None = None) -> Iterator[ApiClient]:
    async def prepare(app: FastAPI) -> None:
        await seed_demo_users(AuthUnitOfWork(app.state.db.sessions), app.state.hasher)
        if idp is not None:
            app.state.identity_provider = identity_provider(
                settings, httpx.AsyncClient(transport=httpx.MockTransport(idp.handle))
            )

    with api_client(create_app(settings, startup=(create_schema(Base.metadata), prepare))) as client:
        yield client


@pytest.fixture
def oidc(idp: FakeIdp) -> Iterator[ApiClient]:
    settings = _settings(
        sso_mode="oidc", oidc_issuer=ISSUER, oidc_client_id=CLIENT_ID, oidc_client_secret=CLIENT_SECRET
    )
    yield from _client(settings, idp)


@pytest.fixture
def passwords_only() -> Iterator[ApiClient]:
    yield from _client(_settings(sso_mode="off"))


def _start(client: ApiClient, next_path: str = "/AI/usage?tab=me") -> str:
    response = client.get(f"{API}/sso/start", params={"next": next_path}, follow_redirects=False)
    assert response.status_code == 302
    return response.headers["location"]


def _callback(client: ApiClient, **params: str) -> str:
    return client.get(f"{API}/sso/callback", params=params, follow_redirects=False).headers["location"]


def test_oidc_sign_in_maps_the_upn_to_the_portal_account(oidc: ApiClient, idp: FakeIdp) -> None:
    authorize = _start(oidc)
    assert authorize.startswith(f"{ISSUER}/protocol/openid-connect/auth?")
    code, state = idp.sign_in(authorize)

    assert _callback(oidc, code=code, state=state) == "/AI/usage?tab=me"
    assert oidc.get(f"{API}/me").json()["userId"] == "u364"
    assert "portal_sso" not in oidc.cookies


def test_oidc_survives_a_signing_key_rotation(oidc: ApiClient, idp: FakeIdp) -> None:
    code, state = idp.sign_in(_start(oidc))
    _callback(oidc, code=code, state=state)
    idp.rotate_key()
    oidc.cookies.clear()

    code, state = idp.sign_in(_start(oidc))

    assert _callback(oidc, code=code, state=state) == "/AI/usage?tab=me"


@pytest.mark.parametrize(
    "tampering",
    [
        {"aud": "another-app"},
        {"iss": "https://evil.example"},
        {"nonce": "replayed"},
        {"exp": 1_000_000_000},
        {"preferred_username": "stranger@corp.example"},
    ],
)
def test_oidc_rejects_an_id_token_that_is_not_for_this_sign_in(
    oidc: ApiClient, idp: FakeIdp, tampering: dict[str, Any]
) -> None:
    idp.overrides = tampering
    code, state = idp.sign_in(_start(oidc))

    assert _callback(oidc, code=code, state=state) == "/AI/login?error=sso"
    assert oidc.get(f"{API}/me").status_code == 401


def test_oidc_rejects_a_token_signed_by_someone_else(oidc: ApiClient, idp: FakeIdp) -> None:
    code, state = idp.sign_in(_start(oidc))
    idp.forged_with = rsa.generate_private_key(public_exponent=65537, key_size=2048)  # claims the published kid

    assert _callback(oidc, code=code, state=state) == "/AI/login?error=sso"


def test_a_callback_from_another_browser_is_refused(oidc: ApiClient, idp: FakeIdp) -> None:
    code, state = idp.sign_in(_start(oidc))
    oidc.cookies.clear()  # the attempt cookie lives only in the browser that started the sign-in

    assert _callback(oidc, code=code, state=state) == "/AI/login?error=sso"


def test_a_state_from_another_attempt_is_refused(oidc: ApiClient, idp: FakeIdp) -> None:
    code, _ = idp.sign_in(_start(oidc))
    _, other_state = idp.sign_in(_start(oidc))
    idp.sign_in(_start(oidc))

    assert _callback(oidc, code=code, state=other_state) == "/AI/login?error=sso"


def test_an_idp_error_goes_back_to_login(oidc: ApiClient) -> None:
    _start(oidc)

    assert _callback(oidc, error="access_denied", error_description="User cancelled") == "/AI/login?error=sso"


def test_an_unreachable_idp_goes_back_to_login(idp: FakeIdp) -> None:
    settings = _settings(sso_mode="oidc", oidc_issuer="https://down.example", oidc_client_id=CLIENT_ID)
    for client in _client(settings, idp):
        assert _start(client) == "/AI/login?error=sso"


def test_sign_in_methods_follow_the_sso_mode(oidc: ApiClient, passwords_only: ApiClient) -> None:
    assert oidc.get(f"{API}/methods").json() == {"sso": True}
    assert passwords_only.get(f"{API}/methods").json() == {"sso": False}


def test_with_sso_off_only_passwords_sign_in(passwords_only: ApiClient) -> None:
    assert _start(passwords_only) == "/AI/login?error=sso_unavailable"
    assert (
        passwords_only.post(f"{API}/login", json={"username": "elad.biton", "password": "portal123"}).status_code == 200
    )


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"sso_mode": "oidc"}, "needs OIDC_ISSUER"),
        ({"sso_mode": "dev", "environment": "production"}, "must not run in production"),
    ],
)
def test_misconfigured_sso_stops_the_service_at_startup(overrides: dict[str, Any], message: str) -> None:
    with pytest.raises(RuntimeError, match=message):
        identity_provider(_settings(**overrides), httpx.AsyncClient())
