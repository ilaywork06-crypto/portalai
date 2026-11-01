from portal_kit.cli import run_cli
from portal_marketplace.infrastructure.persistence import MarketplaceUnitOfWork
from portal_marketplace.infrastructure.seed import seed_demo_catalog
from portal_marketplace.settings import MarketplaceSettings

if __name__ == "__main__":
    run_cli(
        database_url=MarketplaceSettings().database_url,
        seed=lambda db: seed_demo_catalog(MarketplaceUnitOfWork(db.sessions)),
    )
