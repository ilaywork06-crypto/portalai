import logging

from portal_auth.domain.ports import PasswordHasher
from portal_auth.domain.user import User
from portal_auth.infrastructure.persistence import AuthUnitOfWork

log = logging.getLogger(__name__)

DEMO_PASSWORD = "portal123"

# Ids and org nodes match the usage-service demo dataset.
DEMO_USERS = (
    User("u364", "alon.cohen", "אלון כהן", "ראש מדור", "#A0612A", org_node_id="n91", managed_node_ids=["n29"]),
    User("u1", "elad.biton", "אלעד ביטון", "מהנדס DevOps", "#3D6B9E", org_node_id="n35"),
    User("admin", "portal.admin", "צוות הפורטל", "מנהל מערכת", "#6B6354", is_admin=True),
)


async def seed_demo_users(uow: AuthUnitOfWork, hasher: PasswordHasher) -> None:
    async with uow:
        if await uow.users.count():
            return
        password_hash = hasher.hash(DEMO_PASSWORD)
        for user in DEMO_USERS:
            await uow.users.add(
                User(
                    id=user.id,
                    username=user.username,
                    display_name=user.display_name,
                    role=user.role,
                    avatar_color=user.avatar_color,
                    password_hash=password_hash,
                    org_node_id=user.org_node_id,
                    managed_node_ids=list(user.managed_node_ids),
                    is_admin=user.is_admin,
                )
            )
        await uow.commit()
    log.info("seeded %d demo users", len(DEMO_USERS))
