from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from portal_community.domain.model import Category, Post


class FeedOrder(StrEnum):
    NEWEST = "new"
    TOP = "top"


@dataclass(frozen=True, slots=True)
class FeedQuery:
    category: Category | None = None
    tags: tuple[str, ...] = ()
    text: str = ""
    order: FeedOrder = FeedOrder.NEWEST


def popular_tags(posts: Sequence[Post]) -> list[tuple[str, int]]:
    counts = Counter(tag for post in posts for tag in post.tags)
    return sorted(counts.items(), key=lambda pair: -pair[1])


def select(posts: Sequence[Post], query: FeedQuery) -> list[Post]:
    """`posts` arrive newest first. Category, tags (all of them) and text combine."""
    text = query.text.strip().lower()
    matches = [
        post
        for post in posts
        if (query.category is None or post.category == query.category)
        and all(tag in post.tags for tag in query.tags)
        and (not text or post.matches(text))
    ]
    if query.order is FeedOrder.TOP:
        matches.sort(key=lambda post: -post.helpful_count)
    return matches
