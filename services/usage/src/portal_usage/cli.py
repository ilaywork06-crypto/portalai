from portal_kit.cli import run_cli
from portal_usage.infrastructure.seed import seed_demo_usage
from portal_usage.settings import UsageSettings

if __name__ == "__main__":
    run_cli(database_url=UsageSettings().database_url, seed=lambda db: seed_demo_usage(db.sessions))
