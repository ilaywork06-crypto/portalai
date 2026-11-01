from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI

from portal_community.infrastructure.orm import Base
from portal_community.infrastructure.persistence import CommunityUnitOfWork
from portal_community.infrastructure.seed import seed_demo_posts
from portal_community.main import create_app
from portal_community.settings import CommunitySettings
from portal_kit.auth import Principal
from portal_kit.testing import TEST_DATABASE_URL, TEST_SECRET, ApiClient, api_client, create_schema, principal
from portal_kit.visibility import CURRENT_TEXT_VERSION

type Factory = Callable[..., dict[str, object]]


async def _seed(app: FastAPI) -> None:
    await seed_demo_posts(CommunityUnitOfWork(app.state.db.sessions))


@pytest.fixture
def client(tmp_path: Path) -> Iterator[ApiClient]:
    settings = CommunitySettings(
        database_url=TEST_DATABASE_URL,
        jwt_secret=TEST_SECRET,
        environment="test",
        uploads_dir=tmp_path,
        max_upload_bytes=1024,
    )
    with api_client(create_app(settings, startup=(create_schema(Base.metadata), _seed))) as c:
        yield c.login_as(principal("u-dana", display_name="דנה", role="מוצר", avatar_color="#A0612A"))


@pytest.fixture
def other_user() -> Principal:
    return principal("u-omer", display_name="עומר")


@pytest.fixture
def new_post(client: ApiClient) -> Factory:
    def publish(**overrides: object) -> dict[str, object]:
        post = {"category": "טיפים", "title": "כותרת", "body": "גוף", "tags": ["טסט"]} | overrides
        ack = {"confirmed": True, "textVersion": CURRENT_TEXT_VERSION}
        response = client.post("/AI/api/posts", json={"post": post, "visibilityAck": ack})
        assert response.status_code == 201, response.text
        result: dict[str, object] = response.json()
        return result

    return publish
