import json
import logging
from datetime import UTC, datetime, timedelta
from importlib.resources import files
from typing import Any

from portal_kit.ids import utc_now
from portal_marketplace.domain.model import Category, ItemType, MarketItem
from portal_marketplace.infrastructure.persistence import MarketplaceUnitOfWork
from portal_marketplace.infrastructure.specs import spec_from_document

log = logging.getLogger(__name__)


def _snake(doc: dict[str, Any]) -> dict[str, Any]:
    return {"".join(f"_{c.lower()}" if c.isupper() else c for c in key): value for key, value in doc.items()}


def demo_items(now: datetime) -> list[MarketItem]:
    raw = json.loads(files(__package__).joinpath("seed_items.json").read_text(encoding="utf-8"))
    items = []
    for position, entry in enumerate(raw):
        item_type = ItemType(entry["type"])
        items.append(
            MarketItem(
                id=entry["id"],
                type=item_type,
                name=entry["name"],
                blurb=entry["blurb"],
                description=entry["description"],
                icon=entry["icon"],
                category=Category(entry["category"]),
                tags=tuple(entry["tags"]),
                owner_id=f"team:{entry['ownerName']}",
                owner_name=entry["ownerName"],
                publisher=entry["publisher"],
                verified_by=entry["verifiedBy"],
                spec=spec_from_document(item_type, _snake(entry["spec"])),
                published_at=datetime.fromisoformat(entry["publishedAt"]).replace(hour=12, tzinfo=UTC),
                listed_at=now - timedelta(hours=position + 1),
                installs=entry["installs"],
                stars=entry["stars"],
            )
        )
    return items


async def seed_demo_catalog(uow: MarketplaceUnitOfWork) -> None:
    async with uow:
        if await uow.items.list():
            return
        for item in demo_items(utc_now()):
            await uow.items.add(item)
        await uow.commit()
    log.info("seeded the demo catalog")
