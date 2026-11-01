from collections.abc import Iterator

import pytest
from fastapi import FastAPI

from portal_auth.infrastructure.orm import Base
from portal_auth.infrastructure.persistence import AuthUnitOfWork
from portal_auth.infrastructure.seed import seed_demo_users
from portal_auth.main import create_app
from portal_auth.settings import AuthSettings
from portal_kit.testing import TEST_DATABASE_URL, TEST_SECRET, ApiClient, api_client, create_schema


async def _seed(app: FastAPI) -> None:
    await seed_demo_users(AuthUnitOfWork(app.state.db.sessions), app.state.hasher)


@pytest.fixture
def client() -> Iterator[ApiClient]:
    settings = AuthSettings(
        database_url=TEST_DATABASE_URL,
        jwt_secret=TEST_SECRET,
        environment="test",
        cookie_secure=False,
    )
    with api_client(create_app(settings, startup=(create_schema(Base.metadata), _seed))) as c:
        yield c
