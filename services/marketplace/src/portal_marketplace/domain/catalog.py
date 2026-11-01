from collections import Counter
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from enum import StrEnum

from portal_marketplace.domain.model import Category, ItemType, MarketItem


class SortOrder(StrEnum):
    NEWEST = "new"
    INSTALLS = "installs"
    STARS = "stars"


@dataclass(frozen=True, slots=True)
class CatalogQuery:
    type: ItemType | None = None
    categories: frozenset[Category] = frozenset()
    tags: tuple[str, ...] = ()
    text: str = ""
    sort: SortOrder = SortOrder.NEWEST


@dataclass(frozen=True, slots=True)
class Facets:
    categories: tuple[Category, ...] = ()
    tags: tuple[tuple[str, int], ...] = field(default_factory=tuple)


_SORT_KEYS: dict[SortOrder, Callable[[MarketItem], int] | None] = {
    SortOrder.NEWEST: None,
    SortOrder.INSTALLS: lambda item: -item.installs,
    SortOrder.STARS: lambda item: -item.stars,
}


def facets_for(items: Sequence[MarketItem]) -> Facets:
    """Filters offered for a type: its categories (alphabetical) and tags (most used first, then first seen)."""
    tag_counts = Counter(tag for item in items for tag in item.tags)
    return Facets(
        categories=tuple(sorted({item.category for item in items})),
        tags=tuple(sorted(tag_counts.items(), key=lambda pair: -pair[1])),
    )


def browse(items: Sequence[MarketItem], query: CatalogQuery) -> list[MarketItem]:
    """`items` arrive newest first; every sort is stable so ties keep that order."""
    text = query.text.strip().lower()
    matches = [
        item
        for item in items
        if (not query.categories or item.category in query.categories)
        and all(tag in item.tags for tag in query.tags)
        and (not text or text in item.searchable_text())
    ]
    key = _SORT_KEYS[query.sort]
    return sorted(matches, key=key) if key else matches
