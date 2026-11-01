from collections.abc import Callable, Iterator

import pytest
from fastapi import FastAPI

from portal_kit.auth import Principal
from portal_kit.testing import TEST_DATABASE_URL, TEST_SECRET, ApiClient, api_client, create_schema, principal
from portal_kit.visibility import CURRENT_TEXT_VERSION
from portal_marketplace.infrastructure.orm import Base
from portal_marketplace.infrastructure.persistence import MarketplaceUnitOfWork
from portal_marketplace.infrastructure.seed import seed_demo_catalog
from portal_marketplace.main import create_app
from portal_marketplace.settings import MarketplaceSettings

DANA = principal("u-dana", display_name="דנה")
OMER = principal("u-omer", display_name="עומר")

type Factory = Callable[..., dict[str, object]]


async def _seed(app: FastAPI) -> None:
    await seed_demo_catalog(MarketplaceUnitOfWork(app.state.db.sessions))


@pytest.fixture
def client() -> Iterator[ApiClient]:
    settings = MarketplaceSettings(database_url=TEST_DATABASE_URL, jwt_secret=TEST_SECRET, environment="test")
    with api_client(create_app(settings, startup=(create_schema(Base.metadata), _seed))) as c:
        yield c.login_as(DANA)


@pytest.fixture
def other_user() -> Principal:
    return OMER


@pytest.fixture
def skill() -> Factory:
    return _skill


@pytest.fixture
def ack() -> Factory:
    return _ack


def _skill(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "type": "Skill",
        "name": "מסכם בדיקה",
        "blurb": "תקציר",
        "description": "תיאור",
        "icon": "sparkles",
        "category": "תוכנה",
        "tags": ["qa", "בדיקה"],
        "content": "# Skill",
        "repo": "https://gitlab.portal.internal/x",
    }
    return body | overrides


def _ack(**overrides: object) -> dict[str, object]:
    return {"confirmed": True, "textVersion": CURRENT_TEXT_VERSION} | overrides
