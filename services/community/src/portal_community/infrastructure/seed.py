import json
import logging
from datetime import datetime, timedelta
from importlib.resources import files

from portal_community.domain.model import Author, Category, Post, Reply
from portal_community.infrastructure.persistence import CommunityUnitOfWork
from portal_kit.ids import utc_now

log = logging.getLogger(__name__)


def _author(entry: dict[str, str]) -> Author:
    return Author(f"seed:{entry['author']}", entry["author"], entry["role"], entry["avatarColor"])


def demo_posts(now: datetime) -> list[Post]:
    raw = json.loads(files(__package__).joinpath("seed_posts.json").read_text(encoding="utf-8"))
    return [
        Post(
            id=entry["id"],
            author=_author(entry),
            category=Category(entry["category"]),
            title=entry["title"],
            body=entry["body"],
            tags=tuple(entry["tags"]),
            created_at=now - timedelta(seconds=entry["ageSeconds"]),
            helpful_count=entry["helpfulCount"],
            repost_count=entry["reposts"],
            replies=[
                Reply(r["id"], _author(r), r["body"], now - timedelta(seconds=r["ageSeconds"]))
                for r in sorted(entry["replies"], key=lambda r: -r["ageSeconds"])
            ],
        )
        for entry in raw
    ]


async def seed_demo_posts(uow: CommunityUnitOfWork) -> None:
    async with uow:
        if await uow.posts.list():
            return
        for post in demo_posts(utc_now()):
            await uow.posts.add(post)
        await uow.commit()
    log.info("seeded the demo community")
