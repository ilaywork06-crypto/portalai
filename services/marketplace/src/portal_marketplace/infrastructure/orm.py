from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from portal_kit.db import JsonDocument, UtcDateTime, metadata


class Base(DeclarativeBase):
    metadata = metadata()


class ItemRecord(Base):
    __tablename__ = "items"
    __table_args__ = (Index("ix_items_type_listed", "type", "listed_at"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(120))
    blurb: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(40))
    tags: Mapped[list[str]] = mapped_column(JsonDocument, default=list)
    owner_id: Mapped[str] = mapped_column(String(64), index=True)
    owner_name: Mapped[str] = mapped_column(String(200))
    publisher: Mapped[str] = mapped_column(String(200))
    verified_by: Mapped[str | None] = mapped_column(String(200))
    spec: Mapped[dict[str, Any]] = mapped_column(JsonDocument)
    published_at: Mapped[datetime] = mapped_column(UtcDateTime)
    listed_at: Mapped[datetime] = mapped_column(UtcDateTime, index=True)
    updated_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    edited: Mapped[bool] = mapped_column(Boolean, default=False)
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    star_count: Mapped[int] = mapped_column(Integer, default=0)
    visibility_ack: Mapped[dict[str, str] | None] = mapped_column(JsonDocument)


class StarRecord(Base):
    __tablename__ = "item_stars"

    item_id: Mapped[str] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime)


class InstallRecord(Base):
    __tablename__ = "item_installs"

    item_id: Mapped[str] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    method: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime)
