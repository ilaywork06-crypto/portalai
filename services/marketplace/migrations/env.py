import os

from portal_kit.migrations import run_alembic
from portal_marketplace.infrastructure.orm import Base

run_alembic(Base.metadata, os.environ["DATABASE_URL"])
