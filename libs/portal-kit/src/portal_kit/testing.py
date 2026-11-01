from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import MetaData

from portal_kit.app import StartupHook
from portal_kit.auth import Principal, TokenCodec

TEST_SECRET = "test-secret-with-at-least-32-bytes-of-entropy"
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


def principal(user_id: str = "u-test", **overrides: object) -> Principal:
    values: dict[str, object] = {
        "user_id": user_id,
        "display_name": "בודק",
        "role": "QA",
        "avatar_color": "#3C8A5B",
    }
    values |= overrides
    return Principal(**values)  # type: ignore[arg-type]


def create_schema(metadata: MetaData) -> StartupHook:
    async def hook(app: FastAPI) -> None:
        async with app.state.db.engine.begin() as connection:
            await connection.run_sync(metadata.create_all)

    return hook


class ApiClient(TestClient):
    def login_as(self, who: Principal) -> "ApiClient":
        codec: TokenCodec = self.app.state.token_codec  # type: ignore[attr-defined]
        self.cookies.set(self.app.state.settings.session_cookie, codec.encode(who))  # type: ignore[attr-defined]
        return self

    def logout(self) -> "ApiClient":
        self.cookies.clear()
        return self


@contextmanager
def api_client(app: FastAPI) -> Iterator[ApiClient]:
    with ApiClient(app) as client:
        yield client
