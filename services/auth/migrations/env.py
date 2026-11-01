import os

from portal_auth.infrastructure.orm import Base
from portal_kit.migrations import run_alembic

run_alembic(Base.metadata, os.environ["DATABASE_URL"])
