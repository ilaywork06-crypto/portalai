from portal_kit.testing import ApiClient

API = "/AI/api/posts"


def ids(client: ApiClient, **params: object) -> list[str]:
    return [post["id"] for post in client.get(API, params=params).json()["items"]]


def test_feed_is_newest_first_with_relative_ages(client: ApiClient) -> None:
    feed = client.get(API).json()

    assert [p["id"] for p in feed["items"]] == ["c1", "c2", "c3", "c4"]
    first = feed["items"][0]
    assert (first["helpfulCount"], first["viewerHelpful"], first["mine"], len(first["replies"])) == (
        84,
        False,
        False,
        2,
    )
    assert first["replies"][0]["author"] == "תום ב."


def test_popular_tags_come_first_then_by_first_appearance(client: ApiClient) -> None:
    tags = client.get(API).json()["tags"]

    assert tags[:3] == [["הנחיות", 2], ["פרודוקטיביות", 1], ["דיווח", 1]]


def test_filters_combine(client: ApiClient) -> None:
    assert ids(client, category="שאלה") == ["c3"]
    assert ids(client, tag=["הנחיות", "תמיכה"]) == ["c2"]
    assert ids(client, q="rundb") == ["c3"]
    assert ids(client, q="דני") == ["c2"]
    assert ids(client, sort="top") == ["c1", "c2", "c4", "c3"]


def test_feed_requires_a_session(client: ApiClient) -> None:
    client.logout()
    assert client.get(API).status_code == 401
