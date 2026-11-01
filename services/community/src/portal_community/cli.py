from portal_community.infrastructure.persistence import CommunityUnitOfWork
from portal_community.infrastructure.seed import seed_demo_posts
from portal_community.settings import CommunitySettings
from portal_kit.cli import run_cli

if __name__ == "__main__":
    run_cli(
        database_url=CommunitySettings().database_url, seed=lambda db: seed_demo_posts(CommunityUnitOfWork(db.sessions))
    )
