from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from portal_auth.domain.user import User
from portal_auth.infrastructure.orm import UserRecord
from portal_kit.db import SqlAlchemyUnitOfWork


def _to_domain(record: UserRecord) -> User:
    return User(
        id=record.id,
        username=record.username,
        display_name=record.display_name,
        role=record.role,
        avatar_color=record.avatar_color,
        password_hash=record.password_hash,
        org_node_id=record.org_node_id,
        managed_node_ids=list(record.managed_node_ids or []),
        is_admin=record.is_admin,
        active=record.active,
    )


class SqlUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, user_id: str) -> User | None:
        record = await self._session.get(UserRecord, user_id)
        return _to_domain(record) if record else None

    async def by_username(self, username: str) -> User | None:
        record = await self._session.scalar(select(UserRecord).where(UserRecord.username == username))
        return _to_domain(record) if record else None

    async def add(self, user: User) -> None:
        self._session.add(
            UserRecord(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                role=user.role,
                avatar_color=user.avatar_color,
                password_hash=user.password_hash,
                org_node_id=user.org_node_id,
                managed_node_ids=user.managed_node_ids,
                is_admin=user.is_admin,
                active=user.active,
            )
        )

    async def count(self) -> int:
        return await self._session.scalar(select(func.count()).select_from(UserRecord)) or 0


class AuthUnitOfWork(SqlAlchemyUnitOfWork):
    users: SqlUserRepository

    def _bind(self, session: AsyncSession) -> None:
        self.users = SqlUserRepository(session)
