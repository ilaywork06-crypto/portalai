from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

import jwt
from fastapi import Depends, Request

from portal_kit.errors import Forbidden, Unauthorized

ISSUER = "portal-ai-auth"


@dataclass(frozen=True, slots=True)
class Principal:
    user_id: str
    display_name: str
    role: str
    avatar_color: str
    org_node_id: str | None = None
    managed_node_ids: tuple[str, ...] = field(default_factory=tuple)
    is_admin: bool = False

    @property
    def is_manager(self) -> bool:
        return bool(self.managed_node_ids)

    def require_owner_or_admin(self, owner_id: str) -> None:
        if owner_id != self.user_id and not self.is_admin:
            raise Forbidden("Only the owner can change this.")


class TokenCodec:
    def __init__(self, secret: str, *, algorithm: str = "HS256", ttl: timedelta = timedelta(hours=12)) -> None:
        self._secret = secret
        self._algorithm = algorithm
        self.ttl = ttl

    def encode(self, principal: Principal, *, now: datetime | None = None) -> str:
        issued = now or datetime.now(UTC)
        claims: dict[str, Any] = {
            "iss": ISSUER,
            "sub": principal.user_id,
            "iat": issued,
            "exp": issued + self.ttl,
            "name": principal.display_name,
            "role": principal.role,
            "avatar": principal.avatar_color,
            "org": principal.org_node_id,
            "manages": list(principal.managed_node_ids),
            "admin": principal.is_admin,
        }
        return jwt.encode(claims, self._secret, algorithm=self._algorithm)

    def decode(self, token: str) -> Principal:
        try:
            claims = jwt.decode(token, self._secret, algorithms=[self._algorithm], issuer=ISSUER)
        except jwt.PyJWTError as exc:
            raise Unauthorized("The session is invalid or expired.") from exc
        return Principal(
            user_id=claims["sub"],
            display_name=claims["name"],
            role=claims["role"],
            avatar_color=claims["avatar"],
            org_node_id=claims.get("org"),
            managed_node_ids=tuple(claims.get("manages", ())),
            is_admin=bool(claims.get("admin", False)),
        )


def _bearer(request: Request) -> str | None:
    scheme, _, credentials = request.headers.get("Authorization", "").partition(" ")
    return credentials if scheme.lower() == "bearer" and credentials else None


async def current_principal(request: Request) -> Principal:
    token = request.cookies.get(request.app.state.settings.session_cookie) or _bearer(request)
    if not token:
        raise Unauthorized()
    codec: TokenCodec = request.app.state.token_codec
    return codec.decode(token)


CurrentPrincipal = Annotated[Principal, Depends(current_principal)]
