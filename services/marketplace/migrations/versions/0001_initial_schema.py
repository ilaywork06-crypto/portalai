"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-01 14:25:48.737491
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "items",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("blurb", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon", sa.String(length=40), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column(
            "tags", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("owner_name", sa.String(length=200), nullable=False),
        sa.Column("publisher", sa.String(length=200), nullable=False),
        sa.Column("verified_by", sa.String(length=200), nullable=True),
        sa.Column(
            "spec", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("listed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("edited", sa.Boolean(), nullable=False),
        sa.Column("install_count", sa.Integer(), nullable=False),
        sa.Column("star_count", sa.Integer(), nullable=False),
        sa.Column(
            "visibility_ack",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_items")),
    )
    op.create_index(op.f("ix_items_listed_at"), "items", ["listed_at"], unique=False)
    op.create_index(op.f("ix_items_owner_id"), "items", ["owner_id"], unique=False)
    op.create_index("ix_items_type_listed", "items", ["type", "listed_at"], unique=False)
    op.create_table(
        "item_installs",
        sa.Column("item_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("method", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["item_id"], ["items.id"], name=op.f("fk_item_installs_item_id_items"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("item_id", "user_id", name=op.f("pk_item_installs")),
    )
    op.create_table(
        "item_stars",
        sa.Column("item_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["item_id"], ["items.id"], name=op.f("fk_item_stars_item_id_items"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("item_id", "user_id", name=op.f("pk_item_stars")),
    )


def downgrade() -> None:
    op.drop_table("item_stars")
    op.drop_table("item_installs")
    op.drop_index("ix_items_type_listed", table_name="items")
    op.drop_index(op.f("ix_items_owner_id"), table_name="items")
    op.drop_index(op.f("ix_items_listed_at"), table_name="items")
    op.drop_table("items")
