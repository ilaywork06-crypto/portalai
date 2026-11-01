import io
import re
import zipfile
from collections.abc import Sequence
from dataclasses import dataclass
from types import TracebackType
from typing import Protocol, Self

from portal_kit.auth import Principal
from portal_kit.errors import InvalidInput, NotFound
from portal_kit.ids import Clock, new_id, utc_now
from portal_kit.visibility import VisibilityAck
from portal_marketplace.domain.catalog import CatalogQuery, Facets, browse, facets_for
from portal_marketplace.domain.model import AgentSpec, InstallMethod, ItemDraft, MarketItem, SkillSpec
from portal_marketplace.domain.ports import EngagementRepository, ItemRepository


class UnitOfWork(Protocol):
    @property
    def items(self) -> ItemRepository: ...

    @property
    def engagement(self) -> EngagementRepository: ...

    async def __aenter__(self) -> Self: ...
    async def __aexit__(
        self, t: type[BaseException] | None, e: BaseException | None, tb: TracebackType | None
    ) -> None: ...
    async def commit(self) -> None: ...


@dataclass(frozen=True, slots=True)
class ItemView:
    item: MarketItem
    mine: bool
    starred: bool
    installed: bool


@dataclass(frozen=True, slots=True)
class CatalogPage:
    items: list[ItemView]
    facets: Facets
    mine_count: int


@dataclass(frozen=True, slots=True)
class StarState:
    stars: int
    starred: bool


@dataclass(frozen=True, slots=True)
class InstallState:
    installs: int
    installed: bool


@dataclass(frozen=True, slots=True)
class Archive:
    filename: str
    content: bytes


class MarketplaceService:
    def __init__(self, uow: UnitOfWork, *, clock: Clock = utc_now) -> None:
        self._uow = uow
        self._now = clock

    async def catalog(self, viewer: Principal, query: CatalogQuery) -> CatalogPage:
        async with self._uow as uow:
            base = await uow.items.list(item_type=query.type)
            items = browse(base, query)
            views = await self._views(uow, viewer, items)
            mine_count = await uow.items.count_owned(viewer.user_id)
        return CatalogPage(views, facets_for(base), mine_count)

    async def uploads(self, viewer: Principal) -> CatalogPage:
        async with self._uow as uow:
            items = await uow.items.list(owner_id=viewer.user_id)
            views = await self._views(uow, viewer, items)
        return CatalogPage(views, facets_for(items), len(items))

    async def get(self, viewer: Principal, item_id: str) -> ItemView:
        async with self._uow as uow:
            item = await self._require(uow, item_id)
            [view] = await self._views(uow, viewer, [item])
        return view

    async def publish(self, owner: Principal, draft: ItemDraft, ack: VisibilityAck) -> ItemView:
        item = MarketItem.publish(draft, item_id=new_id("mk"), owner=owner, ack=ack, now=self._now())
        async with self._uow as uow:
            await uow.items.add(item)
            await uow.commit()
        return ItemView(item, mine=True, starred=False, installed=False)

    async def revise(self, editor: Principal, item_id: str, draft: ItemDraft) -> ItemView:
        async with self._uow as uow:
            item = await self._require(uow, item_id)
            item.revise(draft, by=editor, now=self._now())
            await uow.items.update(item)
            await uow.commit()
            [view] = await self._views(uow, editor, [item])
        return view

    async def remove(self, editor: Principal, item_id: str) -> None:
        async with self._uow as uow:
            item = await self._require(uow, item_id)
            item.ensure_owned_by(editor)
            await uow.engagement.forget_item(item.id)
            await uow.items.delete(item.id)
            await uow.commit()

    async def star(self, viewer: Principal, item_id: str) -> StarState:
        async with self._uow as uow:
            item = await self._require(uow, item_id)
            added = await uow.engagement.add_star(item.id, viewer.user_id, self._now())
            stars, _ = await uow.items.adjust_counters(item.id, stars=1 if added else 0)
            await uow.commit()
        return StarState(stars, starred=True)

    async def unstar(self, viewer: Principal, item_id: str) -> StarState:
        async with self._uow as uow:
            item = await self._require(uow, item_id)
            removed = await uow.engagement.remove_star(item.id, viewer.user_id)
            stars, _ = await uow.items.adjust_counters(item.id, stars=-1 if removed else 0)
            await uow.commit()
        return StarState(stars, starred=False)

    async def record_install(self, viewer: Principal, item_id: str, method: InstallMethod) -> InstallState:
        async with self._uow as uow:
            item = await self._require(uow, item_id)
            installs = await self._count_install(uow, item, viewer, method)
            await uow.commit()
        return InstallState(installs, installed=True)

    async def archive(self, viewer: Principal, item_id: str) -> Archive:
        async with self._uow as uow:
            item = await self._require(uow, item_id)
            if not isinstance(item.spec, SkillSpec | AgentSpec):
                raise InvalidInput("Only Skills and Agents can be downloaded as ZIP.", code="not_downloadable")
            await self._count_install(uow, item, viewer, InstallMethod.ZIP)
            await uow.commit()
        return Archive(f"{_slug(item.name)}.zip", _zip(item.spec.md_name, item.spec.content))

    @staticmethod
    async def _require(uow: UnitOfWork, item_id: str) -> MarketItem:
        item = await uow.items.get(item_id)
        if item is None:
            raise NotFound("The item does not exist.")
        return item

    async def _count_install(self, uow: UnitOfWork, item: MarketItem, viewer: Principal, method: InstallMethod) -> int:
        first_time = await uow.engagement.add_install(item.id, viewer.user_id, method, self._now())
        _, installs = await uow.items.adjust_counters(item.id, installs=1 if first_time else 0)
        return installs

    @staticmethod
    async def _views(uow: UnitOfWork, viewer: Principal, items: Sequence[MarketItem]) -> list[ItemView]:
        ids = [item.id for item in items]
        starred = await uow.engagement.starred_among(viewer.user_id, ids)
        installed = await uow.engagement.installed_among(viewer.user_id, ids)
        return [ItemView(i, i.is_owned_by(viewer), i.id in starred, i.id in installed) for i in items]


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "skill"


def _zip(filename: str, content: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(filename, content)
    return buffer.getvalue()
