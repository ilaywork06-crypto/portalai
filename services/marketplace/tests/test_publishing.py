import io
import zipfile
from collections.abc import Callable

import pytest

from portal_kit.auth import Principal
from portal_kit.testing import ApiClient

type Factory = Callable[..., dict[str, object]]

API = "/AI/api/market"


@pytest.fixture
def publish(client: ApiClient, skill: Factory, ack: Factory) -> Factory:
    def run(**overrides: object) -> dict[str, object]:
        response = client.post(API, json={"item": skill(**overrides), "visibilityAck": ack()})
        assert response.status_code == 201, response.text
        result: dict[str, object] = response.json()
        return result

    return run


def test_publishing_requires_the_org_wide_confirmation(client: ApiClient, skill: Factory, ack: Factory) -> None:
    unconfirmed = client.post(API, json={"item": skill(), "visibilityAck": ack(confirmed=False)})
    stale = client.post(API, json={"item": skill(), "visibilityAck": ack(textVersion="old")})
    missing = client.post(API, json={"item": skill()})

    assert unconfirmed.json()["error"]["code"] == "visibility_ack_required"
    assert stale.status_code == 409
    assert missing.status_code == 422


@pytest.mark.parametrize(
    "overrides",
    [{"content": ""}, {"repo": " "}, {"category": "פרודוקטיביות"}, {"type": "App"}, {"type": "MCP"}],
)
def test_invalid_items_are_rejected(
    client: ApiClient, skill: Factory, ack: Factory, overrides: dict[str, object]
) -> None:
    response = client.post(API, json={"item": skill(**overrides), "visibilityAck": ack()})

    assert response.status_code == 422


def test_published_items_lead_the_feed_and_my_uploads(client: ApiClient, publish: Factory) -> None:
    item = publish()

    page = client.get(API).json()
    mine = client.get(API, params={"mine": True}).json()

    assert page["items"][0]["id"] == item["id"]
    assert page["mineCount"] == 1
    assert [i["id"] for i in mine["items"]] == [item["id"]]
    assert item["mine"] is True
    assert item["ownerName"] == item["publisher"] == "דנה"


def test_only_the_owner_can_edit_or_delete(
    client: ApiClient, publish: Factory, skill: Factory, other_user: Principal
) -> None:
    item = publish()
    client.login_as(other_user)

    assert client.patch(f"{API}/{item['id']}", json=skill(name="חטוף")).status_code == 403
    assert client.delete(f"{API}/{item['id']}").status_code == 403


def test_editing_marks_the_item_and_can_change_its_type(client: ApiClient, publish: Factory, skill: Factory) -> None:
    item = publish()
    mcp = skill(type="MCP", serverUrl="x.portal.internal", auth="אין צורך באימות", explanation="איך", publisher="ספק")

    edited = client.patch(f"{API}/{item['id']}", json=mcp).json()

    assert (edited["type"], edited["edited"], edited["publisher"]) == ("MCP", True, "ספק")


def test_deleting_removes_the_item_with_its_stars(client: ApiClient, publish: Factory) -> None:
    item = publish()
    client.put(f"{API}/{item['id']}/star")

    assert client.delete(f"{API}/{item['id']}").status_code == 204
    assert client.get(f"{API}/{item['id']}").status_code == 404


def test_stars_toggle_and_are_idempotent(client: ApiClient) -> None:
    assert client.put(f"{API}/jira-mcp/star").json() == {"stars": 58, "viewerStarred": True}
    assert client.put(f"{API}/jira-mcp/star").json()["stars"] == 58
    assert client.get(f"{API}/jira-mcp").json()["viewerStarred"] is True
    assert client.delete(f"{API}/jira-mcp/star").json() == {"stars": 57, "viewerStarred": False}
    assert client.delete(f"{API}/jira-mcp/star").json()["stars"] == 57


def test_installs_count_once_per_user(client: ApiClient, other_user: Principal) -> None:
    first = client.post(f"{API}/jira-mcp/install", json={"method": "claude-code"}).json()
    again = client.post(f"{API}/jira-mcp/install", json={"method": "cli-global"}).json()
    client.login_as(other_user)
    other = client.post(f"{API}/jira-mcp/install", json={"method": "claude-code"}).json()

    assert (first["installs"], again["installs"], other["installs"]) == (511, 511, 512)


def test_skill_zip_contains_the_skill_file_and_counts_as_an_install(client: ApiClient) -> None:
    response = client.get(f"{API}/skill-meeting-recap/zip")

    assert response.headers["content-type"] == "application/zip"
    assert zipfile.ZipFile(io.BytesIO(response.content)).namelist() == ["SKILL.md"]
    assert client.get(f"{API}/skill-meeting-recap").json()["installs"] == 821
    assert client.get(f"{API}/jira-mcp/zip").status_code == 422
