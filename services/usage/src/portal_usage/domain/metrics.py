"""Usage metrics. Per-day series are float32 to match the reference implementation bit for bit."""

import math
from array import array
from collections.abc import Sequence
from dataclasses import dataclass, field

from portal_usage.domain.calendar import DAYS_PER_WEEK, HOURS, WorkCalendar
from portal_usage.domain.config import UsageConfig
from portal_usage.domain.org import DailyUsage, Member, UsageDataset
from portal_usage.domain.window import Filters, HoursFilter, Window


def _float32(length: int) -> array[float]:
    return array("f", bytes(4 * length))


@dataclass(frozen=True, slots=True)
class MemberStats:
    member: Member
    requests: float
    tokens: float
    cost: float
    quiet_requests: float
    quiet_cost: float
    peak_requests: float
    active_days: int
    eligible_days: int
    workday_active: int
    workday_eligible: int
    weekly: bool
    daily: bool
    smart: bool
    strong_share: float
    daily_requests: array[float]
    daily_quiet: array[float]


@dataclass(frozen=True, slots=True)
class ModelUsage:
    model_id: str
    requests: float
    tokens: float
    cost: float


@dataclass(slots=True)
class Aggregate:
    users: int = 0
    requests: float = 0
    tokens: float = 0
    cost: float = 0
    quiet_requests: float = 0
    quiet_cost: float = 0
    installed: int = 0
    first_request: int = 0
    weekly_active: int = 0
    daily_active: int = 0
    smart: int = 0
    active: int = 0
    strong_requests: float = 0
    peak_requests: float = 0
    by_model: list[ModelUsage] = field(default_factory=list)
    requests_series: array[float] = field(default_factory=lambda: _float32(0))
    tokens_series: array[float] = field(default_factory=lambda: _float32(0))
    cost_series: array[float] = field(default_factory=lambda: _float32(0))
    quiet_requests_series: array[float] = field(default_factory=lambda: _float32(0))
    quiet_tokens_series: array[float] = field(default_factory=lambda: _float32(0))
    quiet_cost_series: array[float] = field(default_factory=lambda: _float32(0))
    rows: list[MemberStats] = field(default_factory=list)

    @property
    def quiet_share(self) -> float:
        return self.quiet_requests / self.requests if self.requests else 0

    @property
    def peak_share(self) -> float:
        return self.peak_requests / self.requests if self.requests else 0

    @property
    def strong_share(self) -> float:
        return self.strong_requests / self.requests if self.requests else 0


class UsageEngine:
    """Computes stats for one dataset and config. Member stats are memoized per window, filter and period."""

    def __init__(self, dataset: UsageDataset, config: UsageConfig) -> None:
        self.dataset = dataset
        self.config = config
        self.calendar = WorkCalendar(config)
        self._cost_per_request = {m.id: self._cost_rate(m) for m in dataset.members}
        self._memo: dict[tuple[str, Window, Filters, int], MemberStats] = {}

    def _cost_rate(self, member: Member) -> float:
        blended = 0.0
        for model in self.config.models:
            blended = blended + member.model_share.get(model.id, 0.0) * self.config.blended_rate(model)
        return (member.tokens_per_request / 1e6) * blended

    def member_stats(self, member: Member, window: Window, filters: Filters, offset: int = 0) -> MemberStats:
        key = (member.id, window, filters, offset)
        if key not in self._memo:
            self._memo[key] = self._compute(member, window, filters, offset)
        return self._memo[key]

    def _compute(self, member: Member, window: Window, filters: Filters, offset: int) -> MemberStats:
        cal, weekdays = self.calendar, self.dataset.weekdays
        usage = self.dataset.usage.get(member.id) or DailyUsage((), ())
        start, end = window.bounds(offset)
        length = window.length
        weeks = [False] * math.ceil(length / DAYS_PER_WEEK)
        daily_requests, daily_quiet = _float32(length), _float32(length)
        requests = quiet = all_requests = all_quiet = 0.0
        active = eligible = workday_eligible = workday_active = 0
        work_hours_only = filters.hours is HoursFilter.WORK

        for day in range(max(0, start), end + 1):
            weekday = weekdays[day]
            from_hour = window.start_hour if day == start else 0
            to_hour = window.end_hour if day == end else 24
            partial = from_hour > 0 or to_hour < 24
            work_day = usage.work[day] if usage.work else 0.0
            quiet_day = usage.quiet[day] if usage.quiet else 0.0
            work = work_day * (cal.hour_fraction(weekday, from_hour, to_hour, quiet=False) if partial else 1)
            quiet_part = quiet_day * (cal.hour_fraction(weekday, from_hour, to_hour, quiet=True) if partial else 1)
            total = work + quiet_part
            all_requests += total
            all_quiet += quiet_part
            counted = work if work_hours_only else total
            counted_quiet = 0 if work_hours_only else quiet_part
            if cal.is_work_day(weekday):
                workday_eligible += 1
                if counted > 0:
                    workday_active += 1
            if filters.days == "work" and not cal.is_work_day(weekday):
                continue
            eligible += 1
            if counted > 0:
                active += 1
                weeks[(day - start) // DAYS_PER_WEEK] = True
            requests += counted
            quiet += counted_quiet
            daily_requests[day - start] = counted
            daily_quiet[day - start] = counted_quiet

        cfg = self.config
        strong = member.model_share.get(cfg.strongest_model.id, 0.0)
        rate = self._cost_per_request[member.id]
        quiet_all = all_quiet / all_requests if all_requests else 0
        weekly = active > 0 and sum(weeks) / len(weeks) >= cfg.weekly_pct / 100
        daily = workday_eligible > 0 and workday_active >= (cfg.daily_pct / 100) * workday_eligible
        return MemberStats(
            member=member,
            requests=requests,
            tokens=requests * member.tokens_per_request,
            cost=requests * rate,
            quiet_requests=quiet,
            quiet_cost=quiet * rate,
            peak_requests=(requests - quiet) * member.peak_share,
            active_days=active,
            eligible_days=eligible,
            workday_active=workday_active,
            workday_eligible=workday_eligible,
            weekly=weekly,
            daily=daily,
            smart=daily and quiet_all >= cfg.smart_quiet / 100 and strong <= cfg.smart_strong / 100,
            strong_share=strong,
            daily_requests=daily_requests,
            daily_quiet=daily_quiet,
        )

    def aggregate(self, member_ids: Sequence[str], window: Window, filters: Filters, offset: int = 0) -> Aggregate:
        cfg, length = self.config, window.length
        _, end = window.bounds(offset)
        result = Aggregate(users=len(member_ids))
        for series in (
            "requests_series",
            "tokens_series",
            "cost_series",
            "quiet_requests_series",
            "quiet_tokens_series",
            "quiet_cost_series",
        ):
            setattr(result, series, _float32(length))
        model_requests = [0.0] * len(cfg.models)
        model_tokens = [0.0] * len(cfg.models)
        model_cost = [0.0] * len(cfg.models)

        for member_id in member_ids:
            member = self.dataset.member(member_id)
            if member is None:
                continue
            s = self.member_stats(member, window, filters, offset)
            rate, tpr = self._cost_per_request[member.id], member.tokens_per_request
            result.rows.append(s)
            result.requests += s.requests
            result.tokens += s.tokens
            result.cost += s.cost
            result.quiet_requests += s.quiet_requests
            result.quiet_cost += s.quiet_cost
            result.installed += 1 if member.tools else 0
            result.first_request += 1 if 0 <= member.first_day <= end else 0
            result.weekly_active += s.weekly
            result.daily_active += s.daily
            result.smart += s.smart
            result.active += 1 if s.active_days else 0
            result.strong_requests += s.requests * s.strong_share
            result.peak_requests += s.peak_requests
            for i, model in enumerate(cfg.models):
                share = member.model_share.get(model.id, 0.0)
                tokens = s.tokens * share
                model_tokens[i] += tokens
                model_requests[i] += s.requests * share
                model_cost[i] += (tokens / 1e6) * cfg.blended_rate(model)
            for i in range(length):
                r = s.daily_requests[i]
                if not r:
                    continue
                q = s.daily_quiet[i]
                result.requests_series[i] += r
                result.tokens_series[i] += r * tpr
                result.cost_series[i] += r * rate
                result.quiet_requests_series[i] += q
                result.quiet_tokens_series[i] += q * tpr
                result.quiet_cost_series[i] += q * rate

        model_total = 0.0
        for cost in model_cost:
            model_total += cost
        scale = result.cost / (model_total or 1)
        result.by_model = [
            ModelUsage(model.id, model_requests[i], model_tokens[i], model_cost[i] * scale)
            for i, model in enumerate(cfg.models)
        ]
        return result

    def hourly_load(self, aggregate: Aggregate) -> list[float]:
        work, quiet = aggregate.requests - aggregate.quiet_requests, aggregate.quiet_requests
        loads = []
        for hour in HOURS:
            value = 0.0
            for day in range(DAYS_PER_WEEK):
                value += self.calendar.cell(work, quiet, day, hour)
            loads.append(value)
        return loads

    def weekday_load(self, aggregate: Aggregate) -> list[float]:
        work, quiet = aggregate.requests - aggregate.quiet_requests, aggregate.quiet_requests
        loads = []
        for day in range(DAYS_PER_WEEK):
            value = 0.0
            for hour in HOURS:
                value += self.calendar.cell(work, quiet, day, hour)
            loads.append(value)
        return loads

    def cost_heatmap(self, aggregate: Aggregate) -> list[list[float]]:
        work, quiet = aggregate.cost - aggregate.quiet_cost, aggregate.quiet_cost
        return [[self.calendar.cell(work, quiet, day, hour) for hour in HOURS] for day in range(DAYS_PER_WEEK)]
