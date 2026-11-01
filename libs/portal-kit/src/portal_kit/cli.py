import asyncio
import sys
from collections.abc import Awaitable, Callable

from portal_kit.db import Database
from portal_kit.observability import configure_logging

type Seeder = Callable[[Database], Awaitable[None]]


def run_cli(*, database_url: str, seed: Seeder) -> None:
    """`python -m portal_<service>.cli seed` — loads the demo data once, before the server starts."""
    if sys.argv[1:] != ["seed"]:
        sys.exit(f"usage: python -m {sys.modules['__main__'].__spec__.name} seed")  # type: ignore[union-attr]
    configure_logging("INFO", json_logs=False)

    async def run() -> None:
        database = Database(database_url)
        try:
            await seed(database)
        finally:
            await database.dispose()

    asyncio.run(run())
