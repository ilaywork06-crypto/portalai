from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Literal, Self

from portal_kit.auth import Principal
from portal_kit.errors import Forbidden, InvalidInput, NotFound
from portal_kit.visibility import VisibilityAck

DEFAULT_REPOST_COMMENT = "שווה קריאה."


class Category(StrEnum):
    TIPS = "טיפים"
    QUESTION = "שאלה"
    SHOW_AND_TELL = "הצג וספר"
    DISCUSSION = "דיון"


@dataclass(frozen=True, slots=True)
class Author:
    id: str
    name: str
    role: str
    avatar_color: str

    @classmethod
    def of(cls, principal: Principal) -> Self:
        return cls(principal.user_id, principal.display_name, principal.role, principal.avatar_color)


@dataclass(frozen=True, slots=True)
class Attachment:
    kind: Literal["image", "file"]
    url: str
    name: str
    size: int | None = None


@dataclass(frozen=True, slots=True)
class QuotedPost:
    id: str
    author: Author
    category: Category
    title: str
    body: str
    attachments: tuple[Attachment, ...] = ()


@dataclass(frozen=True, slots=True)
class PostDraft:
    category: Category
    title: str
    body: str
    tags: tuple[str, ...] = ()
    attachments: tuple[Attachment, ...] = ()

    def validated(self) -> Self:
        if not self.title.strip() or not self.body.strip():
            raise InvalidInput("A post needs a title and a body.", code="missing_fields")
        return self


@dataclass(slots=True)
class Reply:
    id: str
    author: Author
    body: str
    created_at: datetime
    edited: bool = False


def _require_text(body: str) -> str:
    if not body.strip():
        raise InvalidInput("A reply cannot be empty.", code="missing_fields")
    return body.strip()


@dataclass(slots=True)
class Post:
    id: str
    author: Author
    category: Category
    title: str
    body: str
    created_at: datetime
    tags: tuple[str, ...] = ()
    attachments: tuple[Attachment, ...] = ()
    edited: bool = False
    helpful_count: int = 0
    repost_count: int = 0
    repost_of: QuotedPost | None = None
    replies: list[Reply] = field(default_factory=list)
    visibility_ack: VisibilityAck | None = None

    @classmethod
    def publish(cls, draft: PostDraft, *, post_id: str, by: Principal, ack: VisibilityAck, now: datetime) -> Self:
        draft.validated()
        return cls(
            id=post_id,
            author=Author.of(by),
            category=draft.category,
            title=draft.title.strip(),
            body=draft.body.strip(),
            tags=draft.tags,
            attachments=draft.attachments,
            created_at=now,
            visibility_ack=ack,
        )

    def repost(self, *, post_id: str, by: Principal, comment: str, now: datetime) -> "Post":
        """Reposting shares content that is already public, so it needs no new visibility confirmation."""
        return Post(
            id=post_id,
            author=Author.of(by),
            category=self.category,
            title=self.title,
            body=comment.strip() or DEFAULT_REPOST_COMMENT,
            created_at=now,
            repost_of=self.quote(),
        )

    def quote(self) -> QuotedPost:
        return self.repost_of or QuotedPost(
            self.id, self.author, self.category, self.title, self.body, self.attachments
        )

    def revise(self, draft: PostDraft, *, by: Principal) -> None:
        self.ensure_owned_by(by)
        draft.validated()
        self.category = draft.category
        self.title = draft.title.strip()
        self.body = draft.body.strip()
        self.tags = draft.tags
        self.attachments = draft.attachments
        self.edited = True

    def ensure_owned_by(self, principal: Principal) -> None:
        if self.author.id != principal.user_id and not principal.is_admin:
            raise Forbidden("Only the author can change this post.")

    def add_reply(self, *, reply_id: str, by: Principal, body: str, now: datetime) -> Reply:
        reply = Reply(reply_id, Author.of(by), _require_text(body), now)
        self.replies.append(reply)
        return reply

    def edit_reply(self, reply_id: str, *, by: Principal, body: str) -> Reply:
        reply = self._own_reply(reply_id, by)
        reply.body = _require_text(body)
        reply.edited = True
        return reply

    def remove_reply(self, reply_id: str, *, by: Principal) -> None:
        self.replies.remove(self._own_reply(reply_id, by))

    def matches(self, text: str) -> bool:
        haystack = " ".join((self.title, self.body, self.author.name, self.author.role, *self.tags)).lower()
        return text in haystack

    def _own_reply(self, reply_id: str, by: Principal) -> Reply:
        reply = next((r for r in self.replies if r.id == reply_id), None)
        if reply is None:
            raise NotFound("The reply does not exist.")
        if reply.author.id != by.user_id and not by.is_admin:
            raise Forbidden("Only the author can change this reply.")
        return reply
