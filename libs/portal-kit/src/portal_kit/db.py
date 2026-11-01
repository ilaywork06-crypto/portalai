from datetime import UTC, datetime
from types import TracebackType
from typing import Any, Self

from sqlalchemy import JSON, DateTime, MetaData, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Dialect
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import TypeDecorator

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def metadata() -> MetaData:
    return MetaData(naming_convention=NAMING_CONVENTION)


JsonDocument = JSON().with_variant(JSONB(), "postgresql")


class UtcDateTime(TypeDecorator[datetime]):
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("naive datetimes are not allowed")
        return value

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class Database:
    def __init__(self, url: str, *, echo: bool = False) -> None:
        options: dict[str, Any] = {"echo": echo}
        if url.startswith("sqlite"):
            options |= {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}
        else:
            options |= {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 10}
        self.engine: AsyncEngine = create_async_engine(url, **options)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False, autoflush=False)

    async def ping(self) -> bool:
        try:
            async with self.engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        except Exception:
            return False
        return True

    async def dispose(self) -> None:
        await self.engine.dispose()


class SqlAlchemyUnitOfWork:
    """Opens a session for one business transaction. Subclasses bind their repositories in `_bind`."""

    session: AsyncSession

    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self._sessions = sessions

    def _bind(self, session: AsyncSession) -> None:
        return None

    async def __aenter__(self) -> Self:
        self.session = self._sessions()
        self._bind(self.session)
        return self

    async def __aexit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, tb: TracebackType | None
    ) -> None:
        if exc_type is not None:
            await self.session.rollback()
        await self.session.close()

    async def commit(self) -> None:
        await self.session.commit()
