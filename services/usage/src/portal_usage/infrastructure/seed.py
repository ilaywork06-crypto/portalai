import gzip
import json
import logging
from datetime import date, timedelta
from importlib.resources import files
from typing import Any

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from portal_usage.domain.org import DailyUsage, Member, OrgNode, UsageDataset
from portal_usage.infrastructure.orm import DailyUsageRecord, MemberRecord, OrgNodeRecord, WatermarkRecord

log = logging.getLogger(__name__)


def load_demo_dataset() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(gzip.decompress(files(__package__).joinpath("dataset.json.gz").read_bytes()))
    return data


async def seed_demo_usage(sessions: async_sessionmaker[AsyncSession]) -> None:
    async with sessions() as session:
        if await session.scalar(select(WatermarkRecord.id).limit(1)) is not None:
            return
        data = load_demo_dataset()
        start = date.fromisoformat(data["start"])

        def day(index: int) -> date:
            return start + timedelta(days=index)

        await session.execute(
            insert(OrgNodeRecord),
            [
                {"id": n["id"], "name": n["name"], "level": n["level"], "parent_id": n["parent"], "position": i}
                for i, n in enumerate(data["nodes"])
            ],
        )
        await session.execute(
            insert(MemberRecord),
            [
                {
                    "id": u["id"],
                    "position": i,
                    "name": u["name"],
                    "role": u["role"],
                    "team_id": u["teamId"],
                    "tools": u["tools"],
                    "model_share": u["modelShare"],
                    "tokens_per_request": u["tokensPerRequest"],
                    "peak_share": u["peakShare"],
                    "first_seen": day(u["firstDay"]) if u["firstDay"] >= 0 else None,
                }
                for i, u in enumerate(data["users"])
            ],
        )
        await session.execute(
            insert(DailyUsageRecord),
            [
                {"member_id": u["id"], "day": day(index), "work_requests": work, "quiet_requests": quiet}
                for u in data["users"]
                for index, work, quiet in u["daily"]
            ],
        )
        session.add(WatermarkRecord(id=1, through_day=day(data["days"] - 1)))
        await session.commit()
    log.info("seeded %d members of demo usage", len(data["users"]))


def dataset_from_document(data: dict[str, Any]) -> UsageDataset:
    """Builds the in-memory dataset straight from the seed document (no database)."""
    days = data["days"]
    children: dict[str, list[str]] = {n["id"]: [] for n in data["nodes"]}
    for node in data["nodes"]:
        if node["parent"]:
            children[node["parent"]].append(node["id"])
    usage = {}
    for u in data["users"]:
        work, quiet = [0.0] * days, [0.0] * days
        for index, w, q in u["daily"]:
            work[index], quiet[index] = w, q
        usage[u["id"]] = DailyUsage(work, quiet)
    return UsageDataset(
        start=date.fromisoformat(data["start"]),
        days=days,
        nodes={
            n["id"]: OrgNode(n["id"], n["name"], n["level"], n["parent"], tuple(children[n["id"]]))
            for n in data["nodes"]
        },
        members=[
            Member(
                id=u["id"],
                name=u["name"],
                role=u["role"],
                team_id=u["teamId"],
                tools=tuple(u["tools"]),
                model_share=u["modelShare"],
                tokens_per_request=u["tokensPerRequest"],
                peak_share=u["peakShare"],
                first_day=u["firstDay"],
            )
            for u in data["users"]
        ],
        usage=usage,
        root_id=next(n["id"] for n in data["nodes"] if n["parent"] is None),
    )
