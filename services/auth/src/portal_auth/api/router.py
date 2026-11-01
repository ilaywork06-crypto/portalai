import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import RedirectResponse

from portal_auth.api.schemas import Identity, PasswordLogin, SignInMethods
from portal_auth.application.service import AuthService, IssuedSession
from portal_auth.domain.errors import SsoFailed, SsoUnavailable
from portal_auth.infrastructure.persistence import AuthUnitOfWork
from portal_auth.settings import AuthSettings
from portal_kit.auth import CurrentPrincipal, Principal

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger(__name__)

ATTEMPT_COOKIE = "portal_sso"
ATTEMPT_MAX_AGE = 600


def auth_service(request: Request) -> AuthService:
    state = request.app.state
    return AuthService(
        AuthUnitOfWork(state.db.sessions),
        hasher=state.hasher,
        tokens=state.token_codec,
        identity_provider=state.identity_provider,
        attempts=state.sso_attempts,
        home_path=state.settings.home_path,
    )


Service = Annotated[AuthService, Depends(auth_service)]


def _settings(request: Request) -> AuthSettings:
    settings: AuthSettings = request.app.state.settings
    return settings


def _identity(principal: Principal) -> Identity:
    return Identity(
        user_id=principal.user_id,
        display_name=principal.display_name,
        role=principal.role,
        avatar_color=principal.avatar_color,
        org_node_id=principal.org_node_id,
        managed_node_ids=list(principal.managed_node_ids),
        is_admin=principal.is_admin,
    )


def _set_session_cookie(response: Response, settings: AuthSettings, session: IssuedSession) -> None:
    response.set_cookie(
        settings.session_cookie,
        session.token,
        max_age=session.max_age,
        path=settings.cookie_path,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


@router.post("/login", response_model=Identity)
async def login(body: PasswordLogin, service: Service, request: Request, response: Response) -> Identity:
    session = await service.login_with_password(body.username, body.password)
    _set_session_cookie(response, _settings(request), session)
    return _identity(session.principal)


def _attempt_cookie_path(settings: AuthSettings) -> str:
    return f"{settings.api_prefix}/auth/sso"


def _back_to_login(settings: AuthSettings, error: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.cookie_path}/login?error={error}", status_code=status.HTTP_302_FOUND)


@router.get("/methods", response_model=SignInMethods)
async def methods(service: Service) -> SignInMethods:
    return SignInMethods(sso=service.sso_enabled)


@router.get("/sso/start", status_code=status.HTTP_302_FOUND)
async def sso_start(
    service: Service, request: Request, next_path: Annotated[str | None, Query(alias="next")] = None
) -> RedirectResponse:
    settings = _settings(request)
    try:
        redirect = await service.start_sso(next_path)
    except SsoUnavailable:
        return _back_to_login(settings, "sso_unavailable")
    except SsoFailed as exc:
        log.warning("SSO could not start: %s", exc.message)
        return _back_to_login(settings, "sso")
    response = RedirectResponse(redirect.url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        ATTEMPT_COOKIE,
        redirect.sealed_attempt,
        max_age=ATTEMPT_MAX_AGE,
        path=_attempt_cookie_path(settings),
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    return response


@router.get("/sso/callback", status_code=status.HTTP_302_FOUND)
async def sso_callback(
    service: Service, request: Request, code: str | None = None, state: str | None = None
) -> RedirectResponse:
    settings = _settings(request)
    try:
        if not code or not state:
            idp_error = request.query_params.get("error_description") or request.query_params.get("error")
            raise SsoFailed(f"The IdP sent no authorization code ({idp_error or 'no reason given'}).")
        session, target = await service.complete_sso(code, state, request.cookies.get(ATTEMPT_COOKIE))
    except SsoUnavailable:
        response = _back_to_login(settings, "sso_unavailable")
    except SsoFailed as exc:
        log.warning("SSO sign-in failed: %s", exc.message)
        response = _back_to_login(settings, "sso")
    else:
        response = RedirectResponse(target, status_code=status.HTTP_302_FOUND)
        _set_session_cookie(response, settings, session)
    response.delete_cookie(ATTEMPT_COOKIE, path=_attempt_cookie_path(settings))
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request) -> Response:
    settings = _settings(request)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(settings.session_cookie, path=settings.cookie_path)
    return response


@router.get("/me", response_model=Identity)
async def me(principal: CurrentPrincipal, service: Service) -> Identity:
    user = await service.current_user(principal)
    return _identity(user.to_principal())
