from portal_kit.testing import ApiClient

API = "/AI/api/market"


def test_catalog_requires_a_session(client: ApiClient) -> None:
    client.logout()
    assert client.get(API).status_code == 401


def test_catalog_lists_the_seed_in_feed_order(client: ApiClient) -> None:
    page = client.get(API).json()

    assert [item["id"] for item in page["items"][:3]] == ["confluence-mcp", "jira-mcp", "gitlab-mcp"]
    assert len(page["items"]) == 21
    assert page["mineCount"] == 0
    jira = page["items"][1]
    assert (jira["installs"], jira["stars"], jira["viewerStarred"], jira["mine"]) == (510, 57, False, False)


def test_type_filter_and_facets(client: ApiClient) -> None:
    page = client.get(API, params={"type": "Skill"}).json()

    assert {item["type"] for item in page["items"]} == {"Skill"}
    assert page["facets"]["categories"] == ["מערכות ארגוניות", "תוכנה"]
    assert page["facets"]["tags"][0] == ["הנדסה", 2]


def test_tags_combine_with_and(client: ApiClient) -> None:
    ids = [i["id"] for i in client.get(API, params=[("tag", "הנדסה"), ("tag", "סקירת קוד")]).json()["items"]]

    assert ids == ["skill-code-review", "portal-dev-kit"]


def test_free_text_search_covers_name_blurb_publisher_and_tags(client: ApiClient) -> None:
    assert [i["id"] for i in client.get(API, params={"q": "JIRA"}).json()["items"]][:1] == ["jira-mcp"]
    assert {i["id"] for i in client.get(API, params={"q": "מערכות עיצוב"}).json()["items"]} == {
        "figma-mcp",
        "ds-frontend",
    }


def test_sort_by_stars_is_stable(client: ApiClient) -> None:
    stars = [i["stars"] for i in client.get(API, params={"sort": "stars"}).json()["items"]]

    assert stars == sorted(stars, reverse=True)


def test_item_detail_flattens_type_specific_fields(client: ApiClient) -> None:
    mcp = client.get(f"{API}/slack-mcp").json()

    assert mcp["serverUrl"] == "slack-mcp.portal.internal"
    assert mcp["auth"] == "נדרש מפתח API"
    assert mcp["publishedAt"].startswith("2026-04-01")
    assert client.get(f"{API}/nope").status_code == 404
