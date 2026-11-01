from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from portal_community.application.service import Feed, PostView
from portal_community.domain.model import Attachment, Author, Category, PostDraft, QuotedPost, Reply
from portal_kit.auth import Principal
from portal_kit.schemas import ApiModel

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class AttachmentModel(ApiModel):
    kind: Literal["image", "file"]
    url: Annotated[str, StringConstraints(max_length=300)]
    name: Annotated[str, StringConstraints(max_length=255)]
    size: int | None = None


class PostInput(ApiModel):
    category: Category
    title: Annotated[Text, StringConstraints(max_length=300)]
    body: Annotated[Text, StringConstraints(max_length=20_000)]
    tags: Annotated[list[Tag], Field(default_factory=list, max_length=20)]
    attachments: Annotated[list[AttachmentModel], Field(default_factory=list, max_length=12)]

    def to_draft(self) -> PostDraft:
        return PostDraft(
            category=self.category,
            title=self.title,
            body=self.body,
            tags=tuple(dict.fromkeys(self.tags)),
            attachments=tuple(Attachment(a.kind, a.url, a.name, a.size) for a in self.attachments),
        )


class VisibilityAckInput(ApiModel):
    confirmed: bool
    text_version: str


class PublishPostRequest(ApiModel):
    post: PostInput
    visibility_ack: VisibilityAckInput


class ReplyInput(ApiModel):
    body: Annotated[Text, StringConstraints(max_length=5_000)]


class RepostInput(ApiModel):
    comment: Annotated[str, StringConstraints(max_length=5_000)] = ""


class AuthorOut(ApiModel):
    author_id: str
    author: str
    role: str
    avatar_color: str


class QuotedPostOut(AuthorOut):
    id: str
    category: Category
    title: str
    body: str
    attachments: list[AttachmentModel]


class ReplyOut(AuthorOut):
    id: str
    body: str
    created_at: datetime
    edited: bool
    mine: bool


class PostOut(AuthorOut):
    id: str
    category: Category
    title: str
    body: str
    tags: list[str]
    attachments: list[AttachmentModel]
    created_at: datetime
    edited: bool
    helpful_count: int
    viewer_helpful: bool
    reposts: int
    repost_of: QuotedPostOut | None
    replies: list[ReplyOut]
    mine: bool


class FeedOut(ApiModel):
    items: list[PostOut]
    tags: list[tuple[str, int]]


class HelpfulOut(ApiModel):
    helpful_count: int
    viewer_helpful: bool


def _author(author: Author) -> dict[str, str]:
    return {"author_id": author.id, "author": author.name, "role": author.role, "avatar_color": author.avatar_color}


def _attachments(items: tuple[Attachment, ...]) -> list[AttachmentModel]:
    return [AttachmentModel(kind=a.kind, url=a.url, name=a.name, size=a.size) for a in items]


def _quote(quote: QuotedPost) -> QuotedPostOut:
    return QuotedPostOut(
        **_author(quote.author),
        id=quote.id,
        category=quote.category,
        title=quote.title,
        body=quote.body,
        attachments=_attachments(quote.attachments),
    )


def _reply(reply: Reply, viewer: Principal) -> ReplyOut:
    return ReplyOut(
        **_author(reply.author),
        id=reply.id,
        body=reply.body,
        created_at=reply.created_at,
        edited=reply.edited,
        mine=reply.author.id == viewer.user_id,
    )


def post_out(view: PostView, viewer: Principal) -> PostOut:
    post = view.post
    return PostOut(
        **_author(post.author),
        id=post.id,
        category=post.category,
        title=post.title,
        body=post.body,
        tags=list(post.tags),
        attachments=_attachments(post.attachments),
        created_at=post.created_at,
        edited=post.edited,
        helpful_count=post.helpful_count,
        viewer_helpful=view.helpful,
        reposts=post.repost_count,
        repost_of=_quote(post.repost_of) if post.repost_of else None,
        replies=[_reply(reply, viewer) for reply in post.replies],
        mine=post.author.id == viewer.user_id,
    )


def feed_out(feed: Feed, viewer: Principal) -> FeedOut:
    return FeedOut(items=[post_out(view, viewer) for view in feed.posts], tags=feed.tags)
