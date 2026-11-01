import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from portal_kit.auth import Principal
from portal_kit.errors import Forbidden, NotFound
from portal_usage.domain.config import UsageConfig
from portal_usage.domain.metrics import Aggregate, UsageEngine
from portal_usage.domain.org import Member, OrgNode, UsageDataset
from portal_usage.domain.window import Filters, Window, custom_window, preset_window


class DatasetSource(Protocol):
    async def load(self) -> UsageDataset: ...


class EngineCache:
    """Usage data refreshes hourly upstream; the engine (and its memoized stats) is rebuilt after `ttl` seconds."""

    def __init__(self, source: DatasetSource, config: UsageConfig, *, ttl: float) -> None:
        self._source = source
        self._config = config
        self._ttl = ttl
        self._engine: UsageEngine | None = None
        self._loaded_at = 0.0
        self._lock = asyncio.Lock()

    async def engine(self) -> UsageEngine:
        if self._engine is None or time.monotonic() - self._loaded_at > self._ttl:
            async with self._lock:
                if self._engine is None or time.monotonic() - self._loaded_at > self._ttl:
                    self._engine = UsageEngine(await self._source.load(), self._config)
                    self._loaded_at = time.monotonic()
        return self._engine


@dataclass(frozen=True, slots=True)
class PeriodRequest:
    days: int | None = None
    start: datetime | None = None
    end: datetime | None = None
    filters: Filters = field(default_factory=Filters)

    def window(self, dataset: UsageDataset) -> Window:
        if self.start is not None and self.end is not None:
            return custom_window(dataset, self.start, self.end)
        return preset_window(dataset, self.days or 30)


@dataclass(frozen=True, slots=True)
class PersonalReport:
    engine: UsageEngine
    member: Member
    window: Window
    current: Aggregate
    previous: Aggregate
    organization: Aggregate


@dataclass(frozen=True, slots=True)
class ChildReport:
    node: OrgNode
    current: Aggregate
    previous: Aggregate


@dataclass(frozen=True, slots=True)
class NodeReport:
    engine: UsageEngine
    node: OrgNode
    path: list[OrgNode]
    window: Window
    current: Aggregate
    previous: Aggregate
    children: list[ChildReport]


@dataclass(frozen=True, slots=True)
class Scope:
    node: OrgNode
    users: int


class UsageService:
    """Reflection only: no goals, comparisons between people, or enforcement. Managers see only their subtree."""

    def __init__(self, engines: EngineCache) -> None:
        self._engines = engines

    async def config(self) -> tuple[UsageConfig, UsageDataset]:
        engine = await self._engines.engine()
        return engine.config, engine.dataset

    async def scopes(self, viewer: Principal) -> list[Scope]:
        dataset = (await self._engines.engine()).dataset
        return [
            Scope(dataset.nodes[node_id], len(dataset.member_ids_under(node_id)))
            for node_id in viewer.managed_node_ids
            if node_id in dataset.nodes
        ]

    async def my_usage(self, viewer: Principal, period: PeriodRequest) -> PersonalReport:
        engine = await self._engines.engine()
        member = engine.dataset.member(viewer.user_id)
        if member is None:
            raise NotFound("No coding-tool usage was recorded for you yet.", code="no_usage")
        return self._personal(engine, member, period)

    async def member_usage(self, viewer: Principal, member_id: str, period: PeriodRequest) -> PersonalReport:
        engine = await self._engines.engine()
        member = engine.dataset.member(member_id)
        if member is None:
            raise NotFound("The user does not exist.")
        self._scope_root(viewer, engine.dataset, member.team_id)
        return self._personal(engine, member, period)

    async def node_usage(self, viewer: Principal, node_id: str, period: PeriodRequest) -> NodeReport:
        engine = await self._engines.engine()
        dataset = engine.dataset
        if node_id not in dataset.nodes:
            raise NotFound("The unit does not exist.")
        root_id = self._scope_root(viewer, dataset, node_id)
        node = dataset.nodes[node_id]
        window = period.window(dataset)
        members = dataset.member_ids_under(node_id)
        full_path = dataset.path(node_id)
        children = [
            ChildReport(
                dataset.nodes[child_id],
                engine.aggregate(dataset.member_ids_under(child_id), window, period.filters),
                engine.aggregate(dataset.member_ids_under(child_id), window, period.filters, offset=1),
            )
            for child_id in node.children
        ]
        return NodeReport(
            engine=engine,
            node=node,
            path=full_path[[n.id for n in full_path].index(root_id) :],
            window=window,
            current=engine.aggregate(members, window, period.filters),
            previous=engine.aggregate(members, window, period.filters, offset=1),
            children=children,
        )

    @staticmethod
    def _personal(engine: UsageEngine, member: Member, period: PeriodRequest) -> PersonalReport:
        window = period.window(engine.dataset)
        everyone = engine.dataset.member_ids_under(engine.dataset.root_id)
        return PersonalReport(
            engine=engine,
            member=member,
            window=window,
            current=engine.aggregate([member.id], window, period.filters),
            previous=engine.aggregate([member.id], window, period.filters, offset=1),
            organization=engine.aggregate(everyone, window, period.filters),
        )

    @staticmethod
    def _scope_root(viewer: Principal, dataset: UsageDataset, node_id: str) -> str:
        for root_id in viewer.managed_node_ids:
            if dataset.contains(root_id, node_id):
                return root_id
        raise Forbidden("This unit is outside the hierarchy you manage.")


def display_name(member: Member, *, viewer: Principal, show_names: bool) -> str:
    if show_names or member.id == viewer.user_id:
        return member.name
    return f"משתמש {member.id.removeprefix('u').zfill(3)}"
