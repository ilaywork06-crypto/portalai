from dataclasses import dataclass
from datetime import datetime, time, timedelta
from enum import StrEnum

from portal_kit.errors import InvalidInput
from portal_usage.domain.org import UsageDataset

PRESET_RANGES = (7, 30, 90)


class HoursFilter(StrEnum):
    ALL = "all"
    WORK = "work"


class DaysFilter(StrEnum):
    ALL = "all"
    WORK = "work"


@dataclass(frozen=True, slots=True)
class Filters:
    hours: HoursFilter = HoursFilter.ALL
    days: DaysFilter = DaysFilter.ALL


@dataclass(frozen=True, slots=True)
class Window:
    """`length` days ending on day index `end`; the first and last day may be cut to [start_hour, end_hour)."""

    end: int
    length: int
    start_hour: int = 0
    end_hour: int = 24

    def bounds(self, offset: int = 0) -> tuple[int, int]:
        end = self.end - offset * self.length
        return end - self.length + 1, end


class InvalidRange(InvalidInput):
    code = "invalid_range"
    default_message = "The end date must be after the start date."


class RangeOutsideData(InvalidInput):
    code = "range_outside_data"
    default_message = "There is no usage data in the selected range."


def preset_window(dataset: UsageDataset, days: int) -> Window:
    if days not in PRESET_RANGES:
        raise InvalidInput(f"Range must be one of {PRESET_RANGES} days.", code="invalid_range")
    return Window(end=dataset.last_day, length=days)


def custom_window(dataset: UsageDataset, start: datetime, end: datetime) -> Window:
    """Whole wall-clock hours, clipped to the days that have data (a saved or shared range may predate them)."""
    start, end = _hour(start), _hour(end)
    if end <= start:
        raise InvalidRange()
    data_start = datetime.combine(dataset.start, time())
    start, end = max(start, data_start), min(end, data_start + timedelta(days=dataset.days))
    if end <= start:
        raise RangeOutsideData()
    first = (start.date() - dataset.start).days
    last = (end.date() - dataset.start).days
    end_day = last - 1 if end.hour == 0 else last
    return Window(end=end_day, length=end_day - first + 1, start_hour=start.hour, end_hour=end.hour or 24)


def _hour(moment: datetime) -> datetime:
    return moment.replace(tzinfo=None, minute=0, second=0, microsecond=0)
