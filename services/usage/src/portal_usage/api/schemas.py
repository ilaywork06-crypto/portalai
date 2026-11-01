from datetime import date

from portal_kit.schemas import ApiModel


class WindowOut(ApiModel):
    start: date
    end: date
    start_hour: int
    end_hour: int
    days: int
    dates: list[date]
    weekdays: list[int]
    is_latest: bool


class TotalsOut(ApiModel):
    users: int
    requests: float
    tokens: float
    cost: float
    quiet_requests: float
    quiet_cost: float
    quiet_share: float
    peak_share: float
    strong_share: float
    installed: int
    first_request: int
    weekly_active: int
    daily_active: int
    smart: int
    active: int


class SeriesOut(ApiModel):
    requests: list[float]
    tokens: list[float]
    cost: list[float]
    quiet_requests: list[float]
    quiet_tokens: list[float]
    quiet_cost: list[float]


class ModelUsageOut(ApiModel):
    model_id: str
    requests: float
    tokens: float
    cost: float


class LoadOut(ApiModel):
    hourly: list[float]
    weekday: list[float]


class MemberOut(ApiModel):
    id: str
    name: str
    role: str
    team_id: str
    unit_path: list[str]
    tools: list[str]
    is_me: bool


class PersonalStatsOut(ApiModel):
    active_days: int
    eligible_days: int
    workday_active: int
    workday_eligible: int
    daily: bool
    strong_share: float


class OrganizationOut(ApiModel):
    daily_active: int
    hourly: list[float]


class PersonalReportOut(ApiModel):
    window: WindowOut
    member: MemberOut
    current: TotalsOut
    previous: TotalsOut
    series: SeriesOut
    by_model: list[ModelUsageOut]
    load: LoadOut
    stats: PersonalStatsOut
    previous_stats: PersonalStatsOut
    organization: OrganizationOut


class NodeRefOut(ApiModel):
    id: str
    name: str
    level: int
    level_name: str


class MemberRefOut(ApiModel):
    id: str
    name: str


class NodeOut(NodeRefOut):
    child_level_name: str | None
    path: list[NodeRefOut]
    children: list[NodeRefOut]
    members: list[MemberRefOut]


class ChildRowOut(ApiModel):
    id: str
    name: str
    users: int
    installed: int
    daily_active: int
    active: int
    cost: float
    tokens: float
    quiet_share: float
    cost_series: list[float]
    previous_cost: float


class UserRowOut(ApiModel):
    id: str
    name: str
    role: str
    team_id: str
    team_name: str
    section_name: str
    is_me: bool
    tools: list[str]
    active_days: int
    eligible_days: int
    requests: float
    tokens: float
    cost: float
    quiet_requests: float
    strong_share: float
    daily_requests: list[float]
    previous_cost: float


class NodeReportOut(ApiModel):
    window: WindowOut
    node: NodeOut
    current: TotalsOut
    previous: TotalsOut
    series: SeriesOut
    by_model: list[ModelUsageOut]
    heatmap: list[list[float]]
    children: list[ChildRowOut]
    users: list[UserRowOut]


class ScopeOut(NodeRefOut):
    users: int


class OrgTreeOut(ApiModel):
    scopes: list[ScopeOut]


class ModelOut(ApiModel):
    id: str
    name: str
    provider: str
    tier: int
    input: float
    output: float
    blended: float
    enabled: bool


class ToolOut(ApiModel):
    id: str
    name: str
    icon: str
    enabled: bool


class TierOut(ApiModel):
    label: str
    sign: str
    hint: str


class DataRangeOut(ApiModel):
    first: date
    last: date


class ConfigOut(ApiModel):
    work_days: list[int]
    work_start: int
    work_end: int
    peaks: list[tuple[int, int]]
    daily_pct: int
    weekly_pct: int
    smart_quiet: int
    smart_strong: int
    premium_warn: int
    default_range: int
    models: list[ModelOut]
    tools: list[ToolOut]
    tiers: dict[str, TierOut]
    data: DataRangeOut
