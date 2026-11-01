"""The metrics must match the reference (design-file) implementation exactly, float for float."""

import json
from pathlib import Path
from typing import Any

import pytest

from portal_usage.domain.metrics import Aggregate, UsageEngine
from portal_usage.domain.window import DaysFilter, Filters, HoursFilter, Window
from portal_usage.infrastructure.config import load_config
from portal_usage.infrastructure.seed import dataset_from_document, load_demo_dataset

GOLDEN = json.loads((Path(__file__).parent / "golden.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def engine() -> UsageEngine:
    return UsageEngine(dataset_from_document(load_demo_dataset()), load_config())


def _packed(engine: UsageEngine, a: Aggregate) -> dict[str, Any]:
    return {
        "users": a.users,
        "requests": a.requests,
        "tokens": a.tokens,
        "cost": a.cost,
        "quietRequests": a.quiet_requests,
        "quietCost": a.quiet_cost,
        "quietShare": a.quiet_share,
        "peakShare": a.peak_share,
        "strongShare": a.strong_share,
        "installed": a.installed,
        "firstRequest": a.first_request,
        "weeklyActive": a.weekly_active,
        "dailyActive": a.daily_active,
        "smart": a.smart,
        "active": a.active,
        "byModel": [[m.requests, m.tokens, m.cost] for m in a.by_model],
        "series": [
            list(a.requests_series),
            list(a.tokens_series),
            list(a.cost_series),
            list(a.quiet_requests_series),
            list(a.quiet_tokens_series),
            list(a.quiet_cost_series),
        ],
        "hourly": engine.hourly_load(a),
        "weekday": engine.weekday_load(a),
        "rows": [
            [
                s.member.id,
                s.requests,
                s.tokens,
                s.cost,
                s.quiet_requests,
                s.active_days,
                s.eligible_days,
                s.workday_active,
                s.workday_eligible,
                s.daily,
                s.strong_share,
                list(s.daily_requests),
            ]
            for s in a.rows
        ],
    }


@pytest.mark.parametrize("scenario", GOLDEN["scenarios"], ids=lambda s: s["name"])
def test_metrics_match_the_reference_implementation(engine: UsageEngine, scenario: dict[str, Any]) -> None:
    assert engine.dataset.start.isoformat() == GOLDEN["start"]
    ids = scenario["ids"] or engine.dataset.member_ids_under(engine.dataset.root_id)
    window = Window(
        end=scenario["endIdx"], length=scenario["range"], start_hour=scenario["sh"], end_hour=scenario["eh"]
    )
    filters = Filters(HoursFilter(scenario["filters"]["hours"]), DaysFilter(scenario["filters"]["days"]))

    for period, offset in (("current", 0), ("previous", 1)):
        actual = _packed(engine, engine.aggregate(ids, window, filters, offset))
        expected = scenario[period]
        for key, value in expected.items():
            assert actual[key] == value, f"{period}.{key}"
