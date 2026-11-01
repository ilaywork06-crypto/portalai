from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from portal_kit.db import JsonDocument, UtcDateTime, metadata


class Base(DeclarativeBase):
    metadata = metadata()


class PostRecord(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    author_id: Mapped[str] = mapped_column(String(64), index=True)
    author_name: Mapped[str] = mapped_column(String(200))
    author_role: Mapped[str] = mapped_column(String(200))
    author_avatar: Mapped[str] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JsonDocument, default=list)
    attachments: Mapped[list[dict[str, Any]]] = mapped_column(JsonDocument, default=list)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, index=True)
    edited: Mapped[bool] = mapped_column(Boolean, default=False)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    repost_count: Mapped[int] = mapped_column(Integer, default=0)
    repost_of: Mapped[dict[str, Any] | None] = mapped_column(JsonDocument)
    visibility_ack: Mapped[dict[str, str] | None] = mapped_column(JsonDocument)

    replies: Mapped[list["ReplyRecord"]] = relationship(
        order_by="ReplyRecord.created_at", cascade="all, delete-orphan", lazy="selectin"
    )


class ReplyRecord(Base):
    __tablename__ = "replies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(String(64))
    author_name: Mapped[str] = mapped_column(String(200))
    author_role: Mapped[str] = mapped_column(String(200))
    author_avatar: Mapped[str] = mapped_column(String(16))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime)
    edited: Mapped[bool] = mapped_column(Boolean, default=False)


class HelpfulRecord(Base):
    __tablename__ = "helpful_marks"

    post_id: Mapped[str] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime)
