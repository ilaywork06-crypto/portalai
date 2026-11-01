from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta

LEVELS = ("ארגון", "יחידה", "מרכז", "ענף", "מדור", "צוות", "יוזר")
LEVELS_PLURAL = ("ארגונים", "יחידות", "מרכזים", "ענפים", "מדורים", "צוותים", "משתמשים")
TEAM_LEVEL = 5


@dataclass(frozen=True, slots=True)
class OrgNode:
    id: str
    name: str
    level: int
    parent_id: str | None
    children: tuple[str, ...] = ()

    @property
    def level_name(self) -> str:
        return LEVELS[self.level]

    @property
    def child_level_plural(self) -> str | None:
        return LEVELS_PLURAL[self.level + 1] if self.level < TEAM_LEVEL else None


@dataclass(frozen=True, slots=True)
class Member:
    id: str
    name: str
    role: str
    team_id: str
    tools: tuple[str, ...]
    model_share: dict[str, float]
    tokens_per_request: float
    peak_share: float
    first_day: int


@dataclass(frozen=True, slots=True)
class DailyUsage:
    """Requests per day in work hours and in quiet hours, indexed by day since `UsageDataset.start`."""

    work: Sequence[float]
    quiet: Sequence[float]


@dataclass(slots=True)
class UsageDataset:
    start: date
    days: int
    nodes: dict[str, OrgNode]
    members: list[Member]
    usage: dict[str, DailyUsage]
    root_id: str
    dates: list[date] = field(init=False, repr=False)
    weekdays: list[int] = field(init=False, repr=False)
    _members_by_id: dict[str, Member] = field(init=False, repr=False)
    _members_under: dict[str, list[str]] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self.dates = [self.start + timedelta(days=i) for i in range(self.days)]
        self.weekdays = [(d.weekday() + 1) % 7 for d in self.dates]  # 0 = Sunday, as in the org calendar
        self._members_by_id = {m.id: m for m in self.members}
        under: dict[str, list[str]] = {node_id: [] for node_id in self.nodes}
        for member in self.members:
            for node in self.path(member.team_id):
                under[node.id].append(member.id)
        self._members_under = under

    @property
    def last_day(self) -> int:
        return self.days - 1

    def member(self, member_id: str) -> Member | None:
        return self._members_by_id.get(member_id)

    def member_ids_under(self, node_id: str) -> list[str]:
        return self._members_under[node_id]

    def path(self, node_id: str) -> list[OrgNode]:
        path: list[OrgNode] = []
        current: str | None = node_id
        while current is not None:
            node = self.nodes[current]
            path.insert(0, node)
            current = node.parent_id
        return path

    def contains(self, ancestor_id: str, node_id: str) -> bool:
        return node_id in self.nodes and any(node.id == ancestor_id for node in self.path(node_id))

    def section_of(self, member: Member) -> OrgNode:
        team = self.nodes[member.team_id]
        return self.nodes[team.parent_id] if team.parent_id else team

    def day_index(self, day: date) -> int:
        return max(0, min(self.last_day, (day - self.start).days))
