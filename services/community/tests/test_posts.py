from collections.abc import Callable

from portal_kit.auth import Principal
from portal_kit.testing import ApiClient

API = "/AI/api/posts"
type Factory = Callable[..., dict[str, object]]


def test_publishing_requires_the_org_wide_confirmation(client: ApiClient) -> None:
    post = {"category": "טיפים", "title": "t", "body": "b"}

    response = client.post(API, json={"post": post, "visibilityAck": {"confirmed": False, "textVersion": "x"}})

    assert response.json()["error"]["code"] == "visibility_ack_required"


def test_new_posts_lead_the_feed_as_mine(client: ApiClient, new_post: Factory) -> None:
    post = new_post()

    assert client.get(API).json()["items"][0]["id"] == post["id"]
    assert (post["author"], post["role"], post["mine"]) == ("דנה", "מוצר", True)


def test_only_the_author_can_edit_or_delete(client: ApiClient, new_post: Factory, other_user: Principal) -> None:
    post = new_post()
    change = {"category": "דיון", "title": "חדש", "body": "גוף"}

    client.login_as(other_user)
    assert client.patch(f"{API}/{post['id']}", json=change).status_code == 403
    assert client.delete(f"{API}/{post['id']}").status_code == 403
    assert client.patch(f"{API}/c1", json=change).status_code == 403


def test_author_edits_are_marked(client: ApiClient, new_post: Factory) -> None:
    post = new_post()

    edited = client.patch(f"{API}/{post['id']}", json={"category": "דיון", "title": "חדש", "body": "גוף"}).json()

    assert (edited["category"], edited["title"], edited["edited"]) == ("דיון", "חדש", True)
    assert client.delete(f"{API}/{post['id']}").status_code == 204
    assert client.get(f"{API}/{post['id']}").status_code == 404


def test_helpful_is_a_toggle(client: ApiClient) -> None:
    assert client.put(f"{API}/c3/helpful").json() == {"helpfulCount": 19, "viewerHelpful": True}
    assert client.put(f"{API}/c3/helpful").json()["helpfulCount"] == 19
    assert client.delete(f"{API}/c3/helpful").json() == {"helpfulCount": 18, "viewerHelpful": False}


def test_replies_can_be_edited_and_removed_by_their_author_only(client: ApiClient, other_user: Principal) -> None:
    post = client.post(f"{API}/c3/replies", json={"body": "תגובה"}).json()
    reply = post["replies"][-1]
    assert (reply["body"], reply["mine"]) == ("תגובה", True)

    edited = client.patch(f"{API}/c3/replies/{reply['id']}", json={"body": "מתוקן"}).json()["replies"][-1]
    assert (edited["body"], edited["edited"]) == ("מתוקן", True)

    client.login_as(other_user)
    assert client.delete(f"{API}/c3/replies/{reply['id']}").status_code == 403
    assert client.patch(f"{API}/c3/replies/c3-r1", json={"body": "x"}).status_code == 403


def test_repost_quotes_the_original_and_counts(client: ApiClient) -> None:
    repost = client.post(f"{API}/c2/repost", json={"comment": ""}).json()
    again = client.post(f"{API}/{repost['id']}/repost", json={"comment": "מסכים"}).json()

    assert repost["body"] == "שווה קריאה."
    assert repost["repostOf"]["id"] == again["repostOf"]["id"] == "c2"
    assert client.get(f"{API}/c2").json()["reposts"] == 4


def test_attachments_are_uploaded_then_linked(client: ApiClient, new_post: Factory) -> None:
    uploaded = client.post("/AI/api/uploads", files={"file": ("shot.png", b"\x89PNG....", "image/png")}).json()
    post = new_post(attachments=[uploaded])

    assert uploaded["kind"] == "image"
    assert post["attachments"][0]["url"] == uploaded["url"]
    download = client.get(uploaded["url"])
    assert download.content == b"\x89PNG...."
    assert download.headers["content-type"] == "image/png"


def test_uploads_are_validated(client: ApiClient, new_post: Factory) -> None:
    too_big = client.post("/AI/api/uploads", files={"file": ("big.bin", b"x" * 2048, "application/octet-stream")})
    foreign = {"kind": "image", "url": "https://evil.example/x.png", "name": "x.png"}
    ack = {"confirmed": True, "textVersion": "org-wide-v1"}
    post = {"category": "טיפים", "title": "t", "body": "b", "attachments": [foreign]}

    assert too_big.json()["error"]["code"] == "file_too_large"
    assert client.post(API, json={"post": post, "visibilityAck": ack}).json()["error"]["code"] == "foreign_attachment"
    assert client.get("/AI/api/uploads/../../etc/passwd").status_code == 404
