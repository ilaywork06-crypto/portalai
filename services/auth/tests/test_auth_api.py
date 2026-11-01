from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import FastAPI

from portal_auth.domain.errors import UnsafeRedirect
from portal_auth.domain.redirects import safe_return_path
from portal_auth.infrastructure.orm import Base
from portal_auth.infrastructure.persistence import AuthUnitOfWork
from portal_auth.infrastructure.seed import DEMO_PASSWORD, seed_demo_users
from portal_auth.main import create_app
from portal_auth.settings import AuthSettings
from portal_kit.testing import TEST_DATABASE_URL, TEST_SECRET, ApiClient, api_client, create_schema

API = "/AI/api/auth"


async def _seed(app: FastAPI) -> None:
    await seed_demo_users(AuthUnitOfWork(app.state.db.sessions), app.state.hasher)


def test_password_login_sets_an_http_only_session(client: ApiClient) -> None:
    response = client.post(f"{API}/login", json={"username": "Alon.Cohen ", "password": DEMO_PASSWORD})

    assert response.status_code == 200
    assert response.json()["displayName"] == "אלון כהן"
    assert response.json()["managedNodeIds"] == ["n29"]
    cookie = response.headers["set-cookie"]
    assert "portal_session=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/AI" in cookie


@pytest.mark.parametrize(("username", "password"), [("alon.cohen", "wrong"), ("nobody", DEMO_PASSWORD)])
def test_bad_credentials_never_reveal_which_field_was_wrong(client: ApiClient, username: str, password: str) -> None:
    response = client.post(f"{API}/login", json={"username": username, "password": password})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


def test_me_requires_a_session(client: ApiClient) -> None:
    assert client.get(f"{API}/me").status_code == 401

    client.post(f"{API}/login", json={"username": "elad.biton", "password": DEMO_PASSWORD})
    me = client.get(f"{API}/me").json()

    assert me["userId"] == "u1"
    assert me["managedNodeIds"] == []


def test_sso_round_trip_lands_on_the_requested_page(client: ApiClient) -> None:
    start = client.get(f"{API}/sso/start", params={"next": "/AI/community/c1"}, follow_redirects=False)
    assert start.status_code == 302
    callback = urlsplit(start.headers["location"])
    assert callback.path == f"{API}/sso/callback"

    done = client.get(callback.path, params=parse_qs(callback.query), follow_redirects=False)

    assert done.status_code == 302
    assert done.headers["location"] == "/AI/community/c1"
    assert client.get(f"{API}/me").json()["userId"] == "u364"


def test_sso_matches_the_account_regardless_of_case() -> None:
    settings = AuthSettings(
        database_url=TEST_DATABASE_URL,
        jwt_secret=TEST_SECRET,
        environment="test",
        cookie_secure=False,
        sso_dev_username=" Elad.Biton",
    )
    app = create_app(settings, startup=(create_schema(Base.metadata), _seed))
    with api_client(app) as client:
        callback = urlsplit(client.get(f"{API}/sso/start", follow_redirects=False).headers["location"])
        client.get(callback.path, params=parse_qs(callback.query), follow_redirects=False)

        assert client.get(f"{API}/me").json()["userId"] == "u1"


def test_sso_with_a_tampered_state_goes_back_to_login(client: ApiClient) -> None:
    response = client.get(f"{API}/sso/callback", params={"code": "dev", "state": "forged"}, follow_redirects=False)

    assert response.headers["location"] == "/AI/login?error=sso"


def test_logout_clears_the_cookie(client: ApiClient) -> None:
    client.post(f"{API}/login", json={"username": "alon.cohen", "password": DEMO_PASSWORD})

    response = client.post(f"{API}/logout")

    assert response.status_code == 204
    assert 'portal_session=""' in response.headers["set-cookie"]


@pytest.mark.parametrize("target", ["https://evil.example/AI/", "//evil.example", "/other", "/AI/api/auth/me"])
def test_only_app_paths_are_allowed_after_sign_in(target: str) -> None:
    with pytest.raises(UnsafeRedirect):
        safe_return_path(target, default="/AI/marketplace")


def test_missing_return_path_falls_back_to_home() -> None:
    assert safe_return_path(None, default="/AI/marketplace") == "/AI/marketplace"
    assert safe_return_path("/AI/usage?tab=me", default="/AI/marketplace") == "/AI/usage?tab=me"
