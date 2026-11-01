from dataclasses import dataclass, field

from portal_kit.auth import Principal


@dataclass(slots=True)
class User:
    id: str
    username: str
    display_name: str
    role: str
    avatar_color: str
    password_hash: str | None = None
    org_node_id: str | None = None
    managed_node_ids: list[str] = field(default_factory=list)
    is_admin: bool = False
    active: bool = True

    def to_principal(self) -> Principal:
        return Principal(
            user_id=self.id,
            display_name=self.display_name,
            role=self.role,
            avatar_color=self.avatar_color,
            org_node_id=self.org_node_id,
            managed_node_ids=tuple(self.managed_node_ids),
            is_admin=self.is_admin,
        )


@dataclass(frozen=True, slots=True)
class ExternalIdentity:
    username: str
