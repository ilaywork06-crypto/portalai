import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import jwt
from argon2 import PasswordHasher as Argon2
from argon2.exceptions import Argon2Error

from portal_auth.domain.errors import SsoFailed
from portal_auth.domain.sso import SignInAttempt
from portal_auth.domain.user import ExternalIdentity


class Argon2PasswordHasher:
    def __init__(self) -> None:
        self._argon = Argon2()
        self._decoy = self._argon.hash(secrets.token_urlsafe(16))

    def hash(self, password: str) -> str:
        return self._argon.hash(password)

    def verify(self, password_hash: str | None, password: str) -> bool:
        try:
            return self._argon.verify(password_hash or self._decoy, password) and password_hash is not None
        except (Argon2Error, ValueError):
            return False


class SignedAttemptCodec:
    """Seals a sign-in attempt for its cookie: signed, short-lived, and unusable as a session token."""

    AUDIENCE = "portal-sso-attempt"

    def __init__(self, secret: str, ttl: timedelta = timedelta(minutes=10)) -> None:
        self._secret = secret
        self._ttl = ttl

    def encode(self, attempt: SignInAttempt) -> str:
        claims = {
            "aud": self.AUDIENCE,
            "next": attempt.return_path,
            "state": attempt.state,
            "nonce": attempt.nonce,
            "pkce": attempt.verifier,
            "exp": datetime.now(UTC) + self._ttl,
        }
        return jwt.encode(claims, self._secret, algorithm="HS256")

    def decode(self, sealed: str) -> SignInAttempt:
        try:
            claims = jwt.decode(sealed, self._secret, algorithms=["HS256"], audience=self.AUDIENCE)
            return SignInAttempt(str(claims["next"]), str(claims["state"]), str(claims["nonce"]), str(claims["pkce"]))
        except (jwt.PyJWTError, KeyError) as exc:
            raise SsoFailed("The sign-in attempt expired or was started in another browser.") from exc


class DevIdentityProvider:
    """Stands in for the corporate IdP in development: always signs in one configured account."""

    def __init__(self, callback_url: str, username: str) -> None:
        self._callback = callback_url
        self._username = username

    async def authorize_url(self, attempt: SignInAttempt) -> str:
        return f"{self._callback}?{urlencode({'code': 'dev', 'state': attempt.state})}"

    async def exchange(self, code: str, attempt: SignInAttempt) -> ExternalIdentity:
        if code != "dev":
            raise SsoFailed()
        return ExternalIdentity(username=self._username)
