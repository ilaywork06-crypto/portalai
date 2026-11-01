from collections.abc import Iterable
from datetime import datetime
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from portal_community.domain.model import Attachment, Author, Category, Post, QuotedPost, Reply
from portal_community.infrastructure.orm import HelpfulRecord, PostRecord, ReplyRecord
from portal_kit.db import SqlAlchemyUnitOfWork
from portal_kit.visibility import VisibilityAck


def _attachments_out(items: tuple[Attachment, ...]) -> list[dict[str, Any]]:
    return [{"kind": a.kind, "url": a.url, "name": a.name, "size": a.size} for a in items]


def _attachments_in(items: list[dict[str, Any]] | None) -> tuple[Attachment, ...]:
    return tuple(Attachment(i["kind"], i["url"], i["name"], i.get("size")) for i in items or ())


def _author_doc(author: Author) -> dict[str, str]:
    return {"id": author.id, "name": author.name, "role": author.role, "avatarColor": author.avatar_color}


def _quote_doc(quote: QuotedPost) -> dict[str, Any]:
    return {
        "id": quote.id,
        "author": _author_doc(quote.author),
        "category": quote.category,
        "title": quote.title,
        "body": quote.body,
        "attachments": _attachments_out(quote.attachments),
    }


def _quote(doc: dict[str, Any]) -> QuotedPost:
    a = doc["author"]
    return QuotedPost(
        id=doc["id"],
        author=Author(a["id"], a["name"], a["role"], a["avatarColor"]),
        category=Category(doc["category"]),
        title=doc["title"],
        body=doc["body"],
        attachments=_attachments_in(doc.get("attachments")),
    )


def _reply(r: ReplyRecord) -> Reply:
    return Reply(
        r.id, Author(r.author_id, r.author_name, r.author_role, r.author_avatar), r.body, r.created_at, r.edited
    )


def _to_domain(r: PostRecord) -> Post:
    return Post(
        id=r.id,
        author=Author(r.author_id, r.author_name, r.author_role, r.author_avatar),
        category=Category(r.category),
        title=r.title,
        body=r.body,
        created_at=r.created_at,
        tags=tuple(r.tags or ()),
        attachments=_attachments_in(r.attachments),
        edited=r.edited,
        helpful_count=r.helpful_count,
        repost_count=r.repost_count,
        repost_of=_quote(r.repost_of) if r.repost_of else None,
        replies=[_reply(reply) for reply in r.replies],
        visibility_ack=VisibilityAck.from_document(r.visibility_ack) if r.visibility_ack else None,
    )


def _reply_record(post_id: str, reply: Reply) -> ReplyRecord:
    return ReplyRecord(
        id=reply.id,
        post_id=post_id,
        author_id=reply.author.id,
        author_name=reply.author.name,
        author_role=reply.author.role,
        author_avatar=reply.author.avatar_color,
        body=reply.body,
        created_at=reply.created_at,
        edited=reply.edited,
    )


def _write(record: PostRecord, post: Post) -> None:
    record.category = post.category
    record.title = post.title
    record.body = post.body
    record.tags = list(post.tags)
    record.attachments = _attachments_out(post.attachments)
    record.edited = post.edited
    existing = {reply.id: reply for reply in record.replies}
    record.replies = [_merge_reply(existing.get(r.id), post.id, r) for r in post.replies]


def _merge_reply(record: ReplyRecord | None, post_id: str, reply: Reply) -> ReplyRecord:
    if record is None:
        return _reply_record(post_id, reply)
    record.body, record.edited = reply.body, reply.edited
    return record


class SqlPostRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, post_id: str) -> Post | None:
        record = await self._session.get(PostRecord, post_id)
        return _to_domain(record) if record else None

    async def list(self) -> list[Post]:
        records = await self._session.scalars(select(PostRecord).order_by(PostRecord.created_at.desc()))
        return [_to_domain(r) for r in records]

    async def add(self, post: Post) -> None:
        record = PostRecord(
            id=post.id,
            author_id=post.author.id,
            author_name=post.author.name,
            author_role=post.author.role,
            author_avatar=post.author.avatar_color,
            created_at=post.created_at,
            helpful_count=post.helpful_count,
            repost_count=post.repost_count,
            repost_of=_quote_doc(post.repost_of) if post.repost_of else None,
            visibility_ack=post.visibility_ack.to_document() if post.visibility_ack else None,
            replies=[],
        )
        _write(record, post)
        self._session.add(record)

    async def update(self, post: Post) -> None:
        record = await self._session.get(PostRecord, post.id)
        if record is not None:
            _write(record, post)

    async def delete(self, post_id: str) -> None:
        await self._session.execute(delete(ReplyRecord).where(ReplyRecord.post_id == post_id))
        await self._session.execute(delete(PostRecord).where(PostRecord.id == post_id))

    async def adjust_counters(self, post_id: str, *, helpful: int = 0, reposts: int = 0) -> tuple[int, int]:
        statement = (
            update(PostRecord)
            .where(PostRecord.id == post_id)
            .values(helpful_count=PostRecord.helpful_count + helpful, repost_count=PostRecord.repost_count + reposts)
            .returning(PostRecord.helpful_count, PostRecord.repost_count)
        )
        helpful_count, repost_count = (await self._session.execute(statement)).one()
        return helpful_count, repost_count


class SqlHelpfulMarks:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def marked_among(self, user_id: str, post_ids: Iterable[str]) -> set[str]:
        query = select(HelpfulRecord.post_id).where(
            HelpfulRecord.user_id == user_id, HelpfulRecord.post_id.in_(list(post_ids))
        )
        return set(await self._session.scalars(query))

    async def mark(self, post_id: str, user_id: str, at: datetime) -> bool:
        try:
            async with self._session.begin_nested():
                self._session.add(HelpfulRecord(post_id=post_id, user_id=user_id, created_at=at))
        except IntegrityError:
            return False
        return True

    async def unmark(self, post_id: str, user_id: str) -> bool:
        result = await self._session.execute(
            delete(HelpfulRecord).where(HelpfulRecord.post_id == post_id, HelpfulRecord.user_id == user_id)
        )
        return bool(getattr(result, "rowcount", 0))

    async def forget_post(self, post_id: str) -> None:
        await self._session.execute(delete(HelpfulRecord).where(HelpfulRecord.post_id == post_id))


class CommunityUnitOfWork(SqlAlchemyUnitOfWork):
    posts: SqlPostRepository
    helpful: SqlHelpfulMarks

    def _bind(self, session: AsyncSession) -> None:
        self.posts = SqlPostRepository(session)
        self.helpful = SqlHelpfulMarks(session)
