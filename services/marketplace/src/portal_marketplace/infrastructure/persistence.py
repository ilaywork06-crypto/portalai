from collections.abc import Iterable
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from portal_kit.db import SqlAlchemyUnitOfWork
from portal_kit.visibility import VisibilityAck
from portal_marketplace.domain.model import Category, InstallMethod, ItemType, MarketItem
from portal_marketplace.infrastructure.orm import InstallRecord, ItemRecord, StarRecord
from portal_marketplace.infrastructure.specs import spec_from_document, spec_to_document


def _to_domain(r: ItemRecord) -> MarketItem:
    item_type = ItemType(r.type)
    return MarketItem(
        id=r.id,
        type=item_type,
        name=r.name,
        blurb=r.blurb,
        description=r.description,
        icon=r.icon,
        category=Category(r.category),
        tags=tuple(r.tags or ()),
        owner_id=r.owner_id,
        owner_name=r.owner_name,
        publisher=r.publisher,
        verified_by=r.verified_by,
        spec=spec_from_document(item_type, r.spec),
        published_at=r.published_at,
        listed_at=r.listed_at,
        updated_at=r.updated_at,
        edited=r.edited,
        installs=r.install_count,
        stars=r.star_count,
        visibility_ack=VisibilityAck.from_document(r.visibility_ack) if r.visibility_ack else None,
    )


def _write(record: ItemRecord, item: MarketItem) -> ItemRecord:
    record.type = item.type
    record.name = item.name
    record.blurb = item.blurb
    record.description = item.description
    record.icon = item.icon
    record.category = item.category
    record.tags = list(item.tags)
    record.owner_id = item.owner_id
    record.owner_name = item.owner_name
    record.publisher = item.publisher
    record.verified_by = item.verified_by
    record.spec = spec_to_document(item.spec)
    record.published_at = item.published_at
    record.listed_at = item.listed_at
    record.updated_at = item.updated_at
    record.edited = item.edited
    record.visibility_ack = item.visibility_ack.to_document() if item.visibility_ack else None
    return record


class SqlItemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, item_id: str) -> MarketItem | None:
        record = await self._session.get(ItemRecord, item_id)
        return _to_domain(record) if record else None

    async def list(self, *, item_type: ItemType | None = None, owner_id: str | None = None) -> list[MarketItem]:
        query = select(ItemRecord).order_by(ItemRecord.listed_at.desc())
        if item_type is not None:
            query = query.where(ItemRecord.type == item_type)
        if owner_id is not None:
            query = query.where(ItemRecord.owner_id == owner_id)
        return [_to_domain(r) for r in await self._session.scalars(query)]

    async def count_owned(self, owner_id: str) -> int:
        query = select(func.count()).select_from(ItemRecord).where(ItemRecord.owner_id == owner_id)
        return await self._session.scalar(query) or 0

    async def add(self, item: MarketItem) -> None:
        record = _write(ItemRecord(id=item.id), item)
        record.install_count, record.star_count = item.installs, item.stars
        self._session.add(record)

    async def update(self, item: MarketItem) -> None:
        record = await self._session.get(ItemRecord, item.id)
        if record is not None:
            _write(record, item)

    async def delete(self, item_id: str) -> None:
        await self._session.execute(delete(ItemRecord).where(ItemRecord.id == item_id))

    async def adjust_counters(self, item_id: str, *, stars: int = 0, installs: int = 0) -> tuple[int, int]:
        statement = (
            update(ItemRecord)
            .where(ItemRecord.id == item_id)
            .values(star_count=ItemRecord.star_count + stars, install_count=ItemRecord.install_count + installs)
            .returning(ItemRecord.star_count, ItemRecord.install_count)
        )
        star_count, install_count = (await self._session.execute(statement)).one()
        return star_count, install_count


class SqlEngagementRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def starred_among(self, user_id: str, item_ids: Iterable[str]) -> set[str]:
        query = select(StarRecord.item_id).where(StarRecord.user_id == user_id, StarRecord.item_id.in_(list(item_ids)))
        return set(await self._session.scalars(query))

    async def installed_among(self, user_id: str, item_ids: Iterable[str]) -> set[str]:
        query = select(InstallRecord.item_id).where(
            InstallRecord.user_id == user_id, InstallRecord.item_id.in_(list(item_ids))
        )
        return set(await self._session.scalars(query))

    async def add_star(self, item_id: str, user_id: str, at: datetime) -> bool:
        return await self._insert_once(StarRecord(item_id=item_id, user_id=user_id, created_at=at))

    async def remove_star(self, item_id: str, user_id: str) -> bool:
        result = await self._session.execute(
            delete(StarRecord).where(StarRecord.item_id == item_id, StarRecord.user_id == user_id)
        )
        return bool(getattr(result, "rowcount", 0))

    async def add_install(self, item_id: str, user_id: str, method: InstallMethod, at: datetime) -> bool:
        return await self._insert_once(InstallRecord(item_id=item_id, user_id=user_id, method=method, created_at=at))

    async def forget_item(self, item_id: str) -> None:
        await self._session.execute(delete(StarRecord).where(StarRecord.item_id == item_id))
        await self._session.execute(delete(InstallRecord).where(InstallRecord.item_id == item_id))

    async def _insert_once(self, record: StarRecord | InstallRecord) -> bool:
        try:
            async with self._session.begin_nested():
                self._session.add(record)
        except IntegrityError:
            return False
        return True


class MarketplaceUnitOfWork(SqlAlchemyUnitOfWork):
    items: SqlItemRepository
    engagement: SqlEngagementRepository

    def _bind(self, session: AsyncSession) -> None:
        self.items = SqlItemRepository(session)
        self.engagement = SqlEngagementRepository(session)
