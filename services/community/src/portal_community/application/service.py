from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from types import TracebackType
from typing import Literal, Protocol, Self

from portal_community.domain.feed import FeedQuery, popular_tags, select
from portal_community.domain.model import Attachment, Post, PostDraft
from portal_community.domain.ports import FileStorage, HelpfulMarks, PostRepository, StoredFile
from portal_kit.auth import Principal
from portal_kit.errors import InvalidInput, NotFound
from portal_kit.ids import Clock, new_id, utc_now
from portal_kit.visibility import VisibilityAck


class UnitOfWork(Protocol):
    @property
    def posts(self) -> PostRepository: ...

    @property
    def helpful(self) -> HelpfulMarks: ...

    async def __aenter__(self) -> Self: ...
    async def __aexit__(
        self, t: type[BaseException] | None, e: BaseException | None, tb: TracebackType | None
    ) -> None: ...
    async def commit(self) -> None: ...


@dataclass(frozen=True, slots=True)
class PostView:
    post: Post
    helpful: bool


@dataclass(frozen=True, slots=True)
class Feed:
    posts: list[PostView]
    tags: list[tuple[str, int]]


@dataclass(frozen=True, slots=True)
class HelpfulState:
    count: int
    helpful: bool


class CommunityService:
    def __init__(
        self, uow: UnitOfWork, files: FileStorage, *, uploads_url: str, max_upload_bytes: int, clock: Clock = utc_now
    ) -> None:
        self._uow = uow
        self._files = files
        self._uploads_url = uploads_url.rstrip("/") + "/"
        self._max_upload = max_upload_bytes
        self._now = clock

    async def feed(self, viewer: Principal, query: FeedQuery) -> Feed:
        async with self._uow as uow:
            posts = await uow.posts.list()
            views = await self._views(uow, viewer, select(posts, query))
        return Feed(views, popular_tags(posts))

    async def get(self, viewer: Principal, post_id: str) -> PostView:
        async with self._uow as uow:
            post = await self._require(uow, post_id)
            [view] = await self._views(uow, viewer, [post])
        return view

    async def publish(self, author: Principal, draft: PostDraft, ack: VisibilityAck) -> PostView:
        self._check_attachments(draft)
        post = Post.publish(draft, post_id=new_id("p"), by=author, ack=ack, now=self._now())
        async with self._uow as uow:
            await uow.posts.add(post)
            await uow.commit()
        return PostView(post, helpful=False)

    async def revise(self, editor: Principal, post_id: str, draft: PostDraft) -> PostView:
        self._check_attachments(draft)
        return await self._change(editor, post_id, lambda post: post.revise(draft, by=editor))

    async def remove(self, editor: Principal, post_id: str) -> None:
        async with self._uow as uow:
            post = await self._require(uow, post_id)
            post.ensure_owned_by(editor)
            await uow.helpful.forget_post(post.id)
            await uow.posts.delete(post.id)
            await uow.commit()

    async def mark_helpful(self, viewer: Principal, post_id: str) -> HelpfulState:
        async with self._uow as uow:
            post = await self._require(uow, post_id)
            added = await uow.helpful.mark(post.id, viewer.user_id, self._now())
            count, _ = await uow.posts.adjust_counters(post.id, helpful=1 if added else 0)
            await uow.commit()
        return HelpfulState(count, helpful=True)

    async def unmark_helpful(self, viewer: Principal, post_id: str) -> HelpfulState:
        async with self._uow as uow:
            post = await self._require(uow, post_id)
            removed = await uow.helpful.unmark(post.id, viewer.user_id)
            count, _ = await uow.posts.adjust_counters(post.id, helpful=-1 if removed else 0)
            await uow.commit()
        return HelpfulState(count, helpful=False)

    async def reply(self, author: Principal, post_id: str, body: str) -> PostView:
        now = self._now()
        return await self._change(
            author, post_id, lambda post: post.add_reply(reply_id=new_id("r"), by=author, body=body, now=now)
        )

    async def edit_reply(self, editor: Principal, post_id: str, reply_id: str, body: str) -> PostView:
        return await self._change(editor, post_id, lambda post: post.edit_reply(reply_id, by=editor, body=body))

    async def remove_reply(self, editor: Principal, post_id: str, reply_id: str) -> PostView:
        return await self._change(editor, post_id, lambda post: post.remove_reply(reply_id, by=editor))

    async def repost(self, author: Principal, post_id: str, comment: str) -> PostView:
        async with self._uow as uow:
            original = await self._require(uow, post_id)
            repost = original.repost(post_id=new_id("p"), by=author, comment=comment, now=self._now())
            await uow.posts.add(repost)
            await uow.posts.adjust_counters(original.id, reposts=1)
            await uow.commit()
        return PostView(repost, helpful=False)

    async def upload(self, owner: Principal, *, name: str, content_type: str, data: bytes) -> Attachment:
        if len(data) > self._max_upload:
            raise InvalidInput(f"Files are limited to {self._max_upload // (1024 * 1024)} MB.", code="file_too_large")
        if not data:
            raise InvalidInput("The file is empty.", code="file_empty")
        stored = await self._files.save(owner_id=owner.user_id, name=name, content_type=content_type, data=data)
        kind: Literal["image", "file"] = "image" if stored.content_type.startswith("image/") else "file"
        return Attachment(kind=kind, url=f"{self._uploads_url}{stored.id}", name=stored.name, size=stored.size)

    async def download(self, file_id: str) -> tuple[StoredFile, Path]:
        located = await self._files.locate(file_id)
        if located is None:
            raise NotFound("The file does not exist.")
        return located

    async def _change(self, actor: Principal, post_id: str, change: Callable[[Post], object]) -> PostView:
        async with self._uow as uow:
            post = await self._require(uow, post_id)
            change(post)
            await uow.posts.update(post)
            await uow.commit()
            [view] = await self._views(uow, actor, [post])
        return view

    def _check_attachments(self, draft: PostDraft) -> None:
        if any(not a.url.startswith(self._uploads_url) for a in draft.attachments):
            raise InvalidInput("Attachments must be uploaded first.", code="foreign_attachment")

    @staticmethod
    async def _require(uow: UnitOfWork, post_id: str) -> Post:
        post = await uow.posts.get(post_id)
        if post is None:
            raise NotFound("The post does not exist.")
        return post

    @staticmethod
    async def _views(uow: UnitOfWork, viewer: Principal, posts: Sequence[Post]) -> list[PostView]:
        marked = await uow.helpful.marked_among(viewer.user_id, [post.id for post in posts])
        return [PostView(post, post.id in marked) for post in posts]
