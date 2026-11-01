from collections.abc import Iterator

import pytest
from fastapi import FastAPI

from portal_kit.auth import Principal
from portal_kit.testing import TEST_DATABASE_URL, TEST_SECRET, ApiClient, api_client, create_schema, principal
from portal_usage.infrastructure.orm import Base
from portal_usage.infrastructure.seed import seed_demo_usage
from portal_usage.main import create_app
from portal_usage.settings import UsageSettings

ALON = principal("u364", display_name="אלון כהן", org_node_id="n91", managed_node_ids=("n29",))


async def _seed(app: FastAPI) -> None:
    await seed_demo_usage(app.state.db.sessions)


@pytest.fixture(scope="module")
def client() -> Iterator[ApiClient]:
    settings = UsageSettings(database_url=TEST_DATABASE_URL, jwt_secret=TEST_SECRET, environment="test")
    with api_client(create_app(settings, startup=(create_schema(Base.metadata), _seed))) as c:
        yield c


@pytest.fixture
def manager(client: ApiClient) -> ApiClient:
    return client.login_as(ALON)


@pytest.fixture
def engineer() -> Principal:
    return principal("u1", display_name="אלעד ביטון", org_node_id="n35")
