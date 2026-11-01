import base64
import hashlib
import secrets
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode

import httpx
import jwt

from portal_auth.domain.errors import SsoFailed
from portal_auth.domain.sso import SignInAttempt
from portal_auth.domain.user import ExternalIdentity

ASYMMETRIC_ALGORITHMS = frozenset(
    {"RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"}
)
DISCOVERY_TTL_SECONDS = 3600.0


@dataclass(frozen=True, slots=True)
class OidcClient:
    """How Portal AI is registered at the IdP. `internal_url` is for when this service reaches the IdP at another
    address than the browser does (e.g. a Keycloak container); the issuer is always the public one."""

    issuer: str
    client_id: str
    client_secret: str
    redirect_uri: str
    scopes: str = "openid profile email"
    username_claim: str = "preferred_username"
    internal_url: str = ""


@dataclass(frozen=True, slots=True)
class _ProviderMetadata:
    authorization_endpoint: str
    token_endpoint: str
    jwks_uri: str
    algorithms: list[str]
    basic_auth: bool


class OidcIdentityProvider:
    """OpenID Connect authorization code flow with PKCE (Entra ID, Okta, ADFS, Keycloak…)."""

    def __init__(self, client: OidcClient, http: httpx.AsyncClient) -> None:
        self._client = client
        self._http = http
        self._metadata: _ProviderMetadata | None = None
        self._discovered_at = 0.0
        self._keys: jwt.PyJWKSet | None = None

    async def authorize_url(self, attempt: SignInAttempt) -> str:
        metadata = await self._discover()
        query = {
            "response_type": "code",
            "client_id": self._client.client_id,
            "redirect_uri": self._client.redirect_uri,
            "scope": self._client.scopes,
            "state": attempt.state,
            "nonce": attempt.nonce,
            "code_challenge": _s256(attempt.verifier),
            "code_challenge_method": "S256",
        }
        return f"{metadata.authorization_endpoint}?{urlencode(query)}"

    async def exchange(self, code: str, attempt: SignInAttempt) -> ExternalIdentity:
        metadata = await self._discover()
        claims = await self._verify(metadata, await self._redeem(metadata, code, attempt.verifier))
        if not secrets.compare_digest(str(claims.get("nonce", "")), attempt.nonce):
            raise SsoFailed("The ID token was issued for a different sign-in attempt.")
        username = claims.get(self._client.username_claim)
        if not isinstance(username, str) or not username:
            raise SsoFailed(f"The ID token has no '{self._client.username_claim}' claim.")
        # Corporate IdPs usually return a UPN (name@corp.example); Portal AI accounts are the part before the @.
        return ExternalIdentity(username=username.split("@", 1)[0])

    async def _discover(self) -> _ProviderMetadata:
        if self._metadata and time.monotonic() - self._discovered_at < DISCOVERY_TTL_SECONDS:
            return self._metadata
        base = (self._client.internal_url or self._client.issuer).rstrip("/")
        document = await self._get_json(f"{base}/.well-known/openid-configuration")
        if document.get("issuer") != self._client.issuer:
            raise SsoFailed(
                f"The IdP calls itself '{document.get('issuer')}', not the configured '{self._client.issuer}'."
            )
        try:
            metadata = _ProviderMetadata(
                authorization_endpoint=document["authorization_endpoint"],
                token_endpoint=document["token_endpoint"],
                jwks_uri=document["jwks_uri"],
                algorithms=[
                    a
                    for a in document.get("id_token_signing_alg_values_supported", ["RS256"])
                    if a in ASYMMETRIC_ALGORITHMS
                ],
                basic_auth="client_secret_basic"
                in document.get("token_endpoint_auth_methods_supported", ["client_secret_basic"]),
            )
        except KeyError as exc:
            raise SsoFailed(f"The IdP discovery document has no {exc}.") from exc
        self._metadata, self._discovered_at, self._keys = metadata, time.monotonic(), None
        return metadata

    async def _redeem(self, metadata: _ProviderMetadata, code: str, verifier: str) -> str:
        form = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self._client.redirect_uri,
            "code_verifier": verifier,
        }
        headers: dict[str, str] = {}
        if self._client.client_secret and metadata.basic_auth:
            credentials = f"{quote(self._client.client_id, safe='')}:{quote(self._client.client_secret, safe='')}"
            headers["Authorization"] = f"Basic {base64.b64encode(credentials.encode()).decode()}"
        else:
            form["client_id"] = self._client.client_id
            if self._client.client_secret:
                form["client_secret"] = self._client.client_secret
        try:
            response = await self._http.post(metadata.token_endpoint, data=form, headers=headers)
        except httpx.HTTPError as exc:
            raise SsoFailed(f"The IdP token endpoint is unreachable: {exc}") from exc
        if response.is_error:
            raise SsoFailed(f"The IdP refused the authorization code ({response.status_code}): {response.text[:200]}")
        id_token = response.json().get("id_token")
        if not isinstance(id_token, str):
            raise SsoFailed("The IdP returned no ID token; is the 'openid' scope allowed for this client?")
        return id_token

    async def _verify(self, metadata: _ProviderMetadata, id_token: str) -> dict[str, Any]:
        try:
            key = await self._signing_key(metadata, jwt.get_unverified_header(id_token).get("kid"))
            claims: dict[str, Any] = jwt.decode(
                id_token,
                key,
                algorithms=metadata.algorithms,
                audience=self._client.client_id,
                issuer=self._client.issuer,
                leeway=60,
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
        except jwt.PyJWTError as exc:
            raise SsoFailed(f"The ID token is not valid: {exc}") from exc
        return claims

    async def _signing_key(self, metadata: _ProviderMetadata, kid: str | None) -> jwt.PyJWK:
        for refetch in (False, True):  # an unknown kid usually means the IdP rotated its keys
            if refetch or self._keys is None:
                self._keys = jwt.PyJWKSet.from_dict(await self._get_json(metadata.jwks_uri))
            for key in self._keys.keys:
                if key.public_key_use in (None, "sig") and (kid is None or key.key_id == kid):
                    return key
        raise SsoFailed(f"The ID token is signed with an unknown key ({kid}).")

    async def _get_json(self, url: str) -> dict[str, Any]:
        try:
            response = await self._http.get(url)
            response.raise_for_status()
            document = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise SsoFailed(f"The IdP is unreachable at {url}: {exc}") from exc
        if not isinstance(document, dict):
            raise SsoFailed(f"The IdP answered {url} with something other than a JSON object.")
        return document


def _s256(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
