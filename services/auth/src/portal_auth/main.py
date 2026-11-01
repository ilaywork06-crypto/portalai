from datetime import timedelta

import httpx
from fastapi import FastAPI

from portal_auth.api.router import router
from portal_auth.domain.ports import IdentityProvider
from portal_auth.infrastructure.oidc import OidcClient, OidcIdentityProvider
from portal_auth.infrastructure.security import Argon2PasswordHasher, DevIdentityProvider, SignedAttemptCodec
from portal_auth.settings import AuthSettings
from portal_kit.app import StartupHook, create_service_app
from portal_kit.auth import TokenCodec


def identity_provider(settings: AuthSettings, http: httpx.AsyncClient) -> IdentityProvider | None:
    callback_path = f"{settings.api_prefix}/auth/sso/callback"
    match settings.sso_mode:
        case "off":
            return None
        case "dev":
            if settings.is_production and not settings.allow_dev_identity_provider:
                raise RuntimeError(
                    "The development identity provider must not run in production; set SSO_MODE=oidc or off."
                )
            return DevIdentityProvider(callback_url=callback_path, username=settings.sso_dev_username)
        case "oidc":
            if not (settings.oidc_issuer and settings.oidc_client_id):
                raise RuntimeError("SSO_MODE=oidc needs OIDC_ISSUER and OIDC_CLIENT_ID.")
            client = OidcClient(
                issuer=settings.oidc_issuer,
                client_id=settings.oidc_client_id,
                client_secret=settings.oidc_client_secret.get_secret_value(),
                redirect_uri=settings.public_url.rstrip("/") + callback_path,
                scopes=settings.oidc_scopes,
                username_claim=settings.oidc_username_claim,
                internal_url=settings.oidc_internal_url,
            )
            return OidcIdentityProvider(client, http)


def create_app(settings: AuthSettings | None = None, *, startup: tuple[StartupHook, ...] = ()) -> FastAPI:
    settings = settings or AuthSettings()

    async def wire(app: FastAPI) -> None:
        secret = settings.jwt_secret.get_secret_value()
        app.state.token_codec = TokenCodec(
            secret, algorithm=settings.jwt_algorithm, ttl=timedelta(hours=settings.session_ttl_hours)
        )
        app.state.hasher = Argon2PasswordHasher()
        app.state.sso_attempts = SignedAttemptCodec(secret)
        app.state.http = httpx.AsyncClient(timeout=httpx.Timeout(10.0))
        app.state.identity_provider = identity_provider(settings, app.state.http)

    async def close(app: FastAPI) -> None:
        await app.state.http.aclose()

    return create_service_app(
        settings, title="Portal AI · Auth", routers=[router], startup=(wire, *startup), shutdown=(close,)
    )
