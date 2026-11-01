from portal_auth.infrastructure.persistence import AuthUnitOfWork
from portal_auth.infrastructure.security import Argon2PasswordHasher
from portal_auth.infrastructure.seed import seed_demo_users
from portal_auth.settings import AuthSettings
from portal_kit.cli import run_cli

if __name__ == "__main__":
    run_cli(
        database_url=AuthSettings().database_url,
        seed=lambda db: seed_demo_users(AuthUnitOfWork(db.sessions), Argon2PasswordHasher()),
    )
