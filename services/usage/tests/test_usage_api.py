import json
from pathlib import Path

import pytest

from portal_kit.auth import Principal
from portal_kit.testing import ApiClient

API = "/AI/api/usage"
GOLDEN = {s["name"]: s for s in json.loads((Path(__file__).parent / "golden.json").read_text("utf-8"))["scenarios"]}


def test_my_usage_matches_the_reference_after_a_database_round_trip(manager: ApiClient) -> None:
    report = manager.get(f"{API}/me", params={"range": 30}).json()
    golden = GOLDEN["me-30"]

    assert report["current"]["requests"] == golden["current"]["requests"]
    assert report["current"]["cost"] == golden["current"]["cost"]
    assert report["series"]["requests"] == golden["current"]["series"][0]
    assert report["load"]["hourly"] == golden["current"]["hourly"]
    assert report["previous"]["tokens"] == golden["previous"]["tokens"]
    assert (report["window"]["start"], report["window"]["end"], report["window"]["isLatest"]) == (
        "2026-09-29",
        "2026-10-28",
        True,
    )
    assert report["member"] == {
        "id": "u364",
        "name": "אלון כהן",
        "role": "ראש מדור",
        "teamId": "n91",
        "unitPath": [
            "יחידת מוצר ועסקים",
            "מרכז נתונים ואנליטיקה",
            "ענף הנדסת נתונים",
            "מדור פלטפורמות נתונים",
            "צוות אוטומציה",
        ],
        "tools": ["claude-code", "roo-code", "other"],
        "isMe": True,
    }


def test_managers_see_their_subtree(manager: ApiClient) -> None:
    section = manager.get(f"{API}/nodes/n29", params={"range": 7, "hours": "all", "days": "work"}).json()
    golden = GOLDEN["section-7-workdays"]["current"]

    assert section["current"]["dailyActive"] == golden["dailyActive"]
    assert section["current"]["cost"] == golden["cost"]
    assert [c["name"] for c in section["children"]] == [
        "צוות אוטומציה",
        "צוות תשתית",
        "צוות שירותים",
        "צוות אינטגרציות",
    ]
    assert [n["id"] for n in section["node"]["path"]] == ["n29"]
    assert len(section["users"]) == section["current"]["users"] == 24
    assert len(section["heatmap"]) == 7

    team = manager.get(f"{API}/nodes/n91").json()
    assert [n["id"] for n in team["node"]["path"]] == ["n29", "n91"]
    assert team["node"]["childLevelName"] is None
    assert manager.get(f"{API}/users/u365").status_code == 200


@pytest.mark.parametrize("path", ["nodes/n0", "nodes/n4", "users/u0"])
def test_anything_outside_the_subtree_is_forbidden(manager: ApiClient, path: str) -> None:
    assert manager.get(f"{API}/{path}").status_code == 403


def test_non_managers_only_see_themselves(client: ApiClient, engineer: Principal) -> None:
    client.login_as(engineer)

    assert client.get("/AI/api/org/tree").json() == {"scopes": []}
    assert client.get(f"{API}/nodes/n35").status_code == 403
    assert client.get(f"{API}/me").json()["member"]["id"] == "u1"


def test_scopes_list_the_managed_units(manager: ApiClient) -> None:
    scopes = manager.get("/AI/api/org/tree").json()["scopes"]

    assert scopes == [{"id": "n29", "name": "מדור פלטפורמות נתונים", "level": 4, "levelName": "מדור", "users": 24}]


def test_custom_range_is_validated(manager: ApiClient) -> None:
    custom = manager.get(f"{API}/me", params={"from": "2026-10-15T09:00", "to": "2026-10-27T18:00"}).json()
    backwards = manager.get(f"{API}/me", params={"from": "2026-10-20T09:00", "to": "2026-10-10T09:00"})

    assert (custom["window"]["days"], custom["window"]["startHour"], custom["window"]["endHour"]) == (13, 9, 18)
    assert backwards.json()["error"]["code"] == "invalid_range"
    assert manager.get(f"{API}/me", params={"range": 15}).status_code == 422


@pytest.mark.parametrize(
    ("start", "end", "expected"),
    [
        ("2026-04-01T09:00", "2026-05-04T18:00", ("2026-05-02", 3, 0, 18)),
        ("2026-10-27T09:00", "2027-01-01T09:00", ("2026-10-27", 2, 9, 24)),
        ("2026-10-27T09:30", "2026-10-27T11:45+02:00", ("2026-10-27", 1, 9, 11)),
    ],
)
def test_custom_range_is_clipped_to_the_data(
    manager: ApiClient, start: str, end: str, expected: tuple[str, int, int, int]
) -> None:
    window = manager.get(f"{API}/me", params={"from": start, "to": end}).json()["window"]

    assert (window["start"], window["days"], window["startHour"], window["endHour"]) == expected


@pytest.mark.parametrize(
    ("start", "end"), [("2025-01-01T09:00", "2025-01-02T09:00"), ("2027-03-01T09:00", "2027-03-05T09:00")]
)
def test_custom_range_without_data_says_so(manager: ApiClient, start: str, end: str) -> None:
    response = manager.get(f"{API}/me", params={"from": start, "to": end})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "range_outside_data"


def test_config_exposes_calendar_models_and_data_range(manager: ApiClient) -> None:
    config = manager.get(f"{API}/config").json()

    assert (config["workStart"], config["workEnd"], config["peaks"]) == (9, 21, [[12, 14], [16, 18]])
    assert config["models"][0]["blended"] == pytest.approx(24)
    assert config["data"] == {"first": "2026-05-02", "last": "2026-10-28"}
    assert config["tiers"]["3"]["sign"] == "$$$"


def test_usage_requires_a_session(client: ApiClient) -> None:
    client.logout()
    assert client.get(f"{API}/me").status_code == 401
