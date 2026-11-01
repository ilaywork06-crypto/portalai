import asyncio
from typing import Any, Literal

from alembic import context
from alembic.autogenerate.api import AutogenContext
from sqlalchemy import MetaData, pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from portal_kit.db import UtcDateTime


def _render_item(kind: str, obj: Any, _: AutogenContext) -> str | Literal[False]:
    if kind == "type" and isinstance(obj, UtcDateTime):
        return "sa.DateTime(timezone=True)"
    return False


def run_alembic(metadata: MetaData, database_url: str) -> None:
    """Shared body of every service's `migrations/env.py`."""
    config = context.config
    config.set_main_option("sqlalchemy.url", database_url)

    if context.is_offline_mode():
        context.configure(
            url=database_url, target_metadata=metadata, literal_binds=True, compare_type=True, render_item=_render_item
        )
        with context.begin_transaction():
            context.run_migrations()
        return

    def run(connection: Connection) -> None:
        context.configure(connection=connection, target_metadata=metadata, compare_type=True, render_item=_render_item)
        with context.begin_transaction():
            context.run_migrations()

    async def run_async() -> None:
        engine = async_engine_from_config(config.get_section(config.config_ini_section, {}), poolclass=pool.NullPool)
        async with engine.connect() as connection:
            await connection.run_sync(run)
        await engine.dispose()

    asyncio.run(run_async())
