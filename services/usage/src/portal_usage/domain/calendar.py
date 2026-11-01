from collections.abc import Callable
from functools import cached_property

from portal_usage.domain.config import UsageConfig

DAYS_PER_WEEK = 7
HOURS = range(24)


class WorkCalendar:
    """Work, peak and quiet hours derived from the config at query time, plus the typical hour-of-week load shape."""

    def __init__(self, config: UsageConfig) -> None:
        self._config = config

    def is_work_day(self, weekday: int) -> bool:
        return weekday in self._config.work_days

    def is_quiet(self, weekday: int, hour: int) -> bool:
        return not self.is_work_day(weekday) or hour < self._config.work_start or hour >= self._config.work_end

    def is_peak(self, weekday: int, hour: int) -> bool:
        return not self.is_quiet(weekday, hour) and any(a <= hour < b for a, b in self._config.peaks)

    def work_weight(self, weekday: int, hour: int) -> float:
        if self.is_quiet(weekday, hour):
            return 0
        if self.is_peak(weekday, hour):
            base = 1.0
        elif 10 <= hour < 12 or 14 <= hour < 16:
            base = 0.7
        else:
            base = 0.48
        return base * (0.85 if weekday == 4 else 1)

    def quiet_weight(self, weekday: int, hour: int) -> float:
        if not self.is_quiet(weekday, hour):
            return 0
        if not self.is_work_day(weekday):
            return 0.35 if 10 <= hour <= 23 else 0.25 if hour < 2 else 0.04
        if hour >= 21:
            return 0.8 - (hour - 21) * 0.18
        return 0.3 if hour < 2 else 0.06 if hour < 7 else 0.2

    @cached_property
    def work_norm(self) -> float:
        return _week_sum(self.work_weight)

    @cached_property
    def quiet_norm(self) -> float:
        return _week_sum(self.quiet_weight)

    def hour_fraction(self, weekday: int, start: int, end: int, *, quiet: bool) -> float:
        """Share of a day's work (or quiet) requests that falls in [start, end)."""
        weight = self.quiet_weight if quiet else self.work_weight
        inside = total = 0.0
        for hour in HOURS:
            value = weight(weekday, hour)
            total += value
            if start <= hour < end:
                inside += value
        return inside / total if total else 0

    def cell(self, work: float, quiet: float, weekday: int, hour: int) -> float:
        return (work * self.work_weight(weekday, hour)) / self.work_norm + (
            quiet * self.quiet_weight(weekday, hour)
        ) / self.quiet_norm


def _week_sum(weight: Callable[[int, int], float]) -> float:
    total = 0.0
    for day in range(DAYS_PER_WEEK):
        for hour in HOURS:
            total += weight(day, hour)
    return total
