from collections import defaultdict
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from portal_kit.errors import ServiceError
from portal_usage.domain.org import DailyUsage, Member, OrgNode, UsageDataset
from portal_usage.infrastructure.orm import DailyUsageRecord, MemberRecord, OrgNodeRecord, WatermarkRecord


class UsageDataUnavailable(ServiceError):
    status_code = 503
    code = "usage_unavailable"
    default_message = "Usage data has not been ingested yet."


class SqlDatasetSource:
    def __init__(self, sessions: async_sessionmaker[AsyncSession], *, retention_days: int) -> None:
        self._sessions = sessions
        self._days = retention_days

    async def load(self) -> UsageDataset:
        async with self._sessions() as session:
            watermark = await session.scalar(select(WatermarkRecord.through_day).limit(1))
            if watermark is None:
                raise UsageDataUnavailable()
            start = watermark - timedelta(days=self._days - 1)
            nodes = list(await session.scalars(select(OrgNodeRecord).order_by(OrgNodeRecord.position)))
            members = list(await session.scalars(select(MemberRecord).order_by(MemberRecord.position)))
            rows = await session.execute(
                select(
                    DailyUsageRecord.member_id,
                    DailyUsageRecord.day,
                    DailyUsageRecord.work_requests,
                    DailyUsageRecord.quiet_requests,
                ).where(DailyUsageRecord.day.between(start, watermark))
            )
            work: defaultdict[str, list[float]] = defaultdict(lambda: [0.0] * self._days)
            quiet: defaultdict[str, list[float]] = defaultdict(lambda: [0.0] * self._days)
            for member_id, day, work_requests, quiet_requests in rows:
                index = (day - start).days
                work[member_id][index] = work_requests
                quiet[member_id][index] = quiet_requests

        children: defaultdict[str, list[str]] = defaultdict(list)
        for node in nodes:
            if node.parent_id:
                children[node.parent_id].append(node.id)
        return UsageDataset(
            start=start,
            days=self._days,
            nodes={n.id: OrgNode(n.id, n.name, n.level, n.parent_id, tuple(children[n.id])) for n in nodes},
            members=[
                Member(
                    id=m.id,
                    name=m.name,
                    role=m.role,
                    team_id=m.team_id,
                    tools=tuple(m.tools),
                    model_share=dict(m.model_share),
                    tokens_per_request=m.tokens_per_request,
                    peak_share=m.peak_share,
                    first_day=(m.first_seen - start).days if m.first_seen else -1,
                )
                for m in members
            ],
            usage={m.id: DailyUsage(work[m.id], quiet[m.id]) for m in members},
            root_id=next(n.id for n in nodes if n.parent_id is None),
        )
