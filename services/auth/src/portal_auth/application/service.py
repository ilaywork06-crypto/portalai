import asyncio
from dataclasses import dataclass
from types import TracebackType
from typing import Protocol, Self

from portal_auth.domain.errors import InvalidCredentials, SsoFailed, SsoUnavailable
from portal_auth.domain.ports import IdentityProvider, PasswordHasher, UserRepository
from portal_auth.domain.redirects import safe_return_path
from portal_auth.domain.sso import SignInAttempt
from portal_auth.domain.user import User
from portal_kit.auth import Principal, TokenCodec
from portal_kit.errors import NotFound


class UnitOfWork(Protocol):
    @property
    def users(self) -> UserRepository: ...

    async def __aenter__(self) -> Self: ...
    async def __aexit__(
        self, t: type[BaseException] | None, e: BaseException | None, tb: TracebackType | None
    ) -> None: ...
    async def commit(self) -> None: ...


class AttemptCodec(Protocol):
    def encode(self, attempt: SignInAttempt) -> str: ...
    def decode(self, sealed: str) -> SignInAttempt: ...


@dataclass(frozen=True, slots=True)
class IssuedSession:
    token: str
    principal: Principal
    max_age: int


@dataclass(frozen=True, slots=True)
class SsoRedirect:
    url: str
    sealed_attempt: str


class AuthService:
    def __init__(
        self,
        uow: UnitOfWork,
        *,
        hasher: PasswordHasher,
        tokens: TokenCodec,
        identity_provider: IdentityProvider | None,
        attempts: AttemptCodec,
        home_path: str,
    ) -> None:
        self._uow = uow
        self._hasher = hasher
        self._tokens = tokens
        self._idp = identity_provider
        self._attempts = attempts
        self._home = home_path

    @property
    def sso_enabled(self) -> bool:
        return self._idp is not None

    async def login_with_password(self, username: str, password: str) -> IssuedSession:
        async with self._uow as uow:
            user = await uow.users.by_username(_normalized(username))
        stored = user.password_hash if user and user.active else None
        valid = await asyncio.to_thread(self._hasher.verify, stored, password)
        if user is None or stored is None or not valid:
            raise InvalidCredentials()
        return self._issue(user)

    async def start_sso(self, return_path: str | None) -> SsoRedirect:
        """The sealed attempt goes into a cookie for this browser until the IdP sends it back."""
        idp = self._identity_provider()
        attempt = SignInAttempt.begin(safe_return_path(return_path, default=self._home))
        return SsoRedirect(await idp.authorize_url(attempt), self._attempts.encode(attempt))

    async def complete_sso(self, code: str, state: str, sealed_attempt: str | None) -> tuple[IssuedSession, str]:
        idp = self._identity_provider()
        attempt = self._attempts.decode(sealed_attempt or "")
        if not attempt.answers(state):
            raise SsoFailed("The IdP response belongs to a different sign-in attempt.")
        identity = await idp.exchange(code, attempt)
        async with self._uow as uow:
            user = await uow.users.by_username(_normalized(identity.username))
        if user is None or not user.active:
            raise SsoFailed(f"The IdP account '{identity.username}' has no access to Portal AI.")
        return self._issue(user), attempt.return_path

    async def current_user(self, principal: Principal) -> User:
        async with self._uow as uow:
            user = await uow.users.get(principal.user_id)
        if user is None or not user.active:
            raise NotFound("The account no longer exists.")
        return user

    def _identity_provider(self) -> IdentityProvider:
        if self._idp is None:
            raise SsoUnavailable()
        return self._idp

    def _issue(self, user: User) -> IssuedSession:
        principal = user.to_principal()
        return IssuedSession(self._tokens.encode(principal), principal, int(self._tokens.ttl.total_seconds()))


def _normalized(username: str) -> str:
    return username.strip().lower()
