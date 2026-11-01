from sqlalchemy import Boolean, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from portal_kit.db import JsonDocument, metadata


class Base(DeclarativeBase):
    metadata = metadata()


class UserRecord(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(120), unique=True)
    display_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(120))
    avatar_color: Mapped[str] = mapped_column(String(16))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    org_node_id: Mapped[str | None] = mapped_column(String(64))
    managed_node_ids: Mapped[list[str]] = mapped_column(JsonDocument, default=list)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
