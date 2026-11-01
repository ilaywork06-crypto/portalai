"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-01 14:25:51.130640
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
        "org_nodes",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("level", sa.SmallInteger(), nullable=False),
        sa.Column("parent_id", sa.String(length=64), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["org_nodes.id"], name=op.f("fk_org_nodes_parent_id_org_nodes")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_org_nodes")),
    )
    op.create_index(op.f("ix_org_nodes_parent_id"), "org_nodes", ["parent_id"], unique=False)
    op.create_table(
        "usage_watermark",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("through_day", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usage_watermark")),
    )
    op.create_table(
        "org_members",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=120), nullable=False),
        sa.Column("team_id", sa.String(length=64), nullable=False),
        sa.Column(
            "tools", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column(
            "model_share", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column("tokens_per_request", sa.Double(), nullable=False),
        sa.Column("peak_share", sa.Double(), nullable=False),
        sa.Column("first_seen", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["team_id"], ["org_nodes.id"], name=op.f("fk_org_members_team_id_org_nodes")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_org_members")),
    )
    op.create_index(op.f("ix_org_members_team_id"), "org_members", ["team_id"], unique=False)
    op.create_table(
        "usage_daily",
        sa.Column("member_id", sa.String(length=64), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("work_requests", sa.Double(), nullable=False),
        sa.Column("quiet_requests", sa.Double(), nullable=False),
        sa.ForeignKeyConstraint(["member_id"], ["org_members.id"], name=op.f("fk_usage_daily_member_id_org_members")),
        sa.PrimaryKeyConstraint("member_id", "day", name=op.f("pk_usage_daily")),
    )
    op.create_index(op.f("ix_usage_daily_day"), "usage_daily", ["day"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_usage_daily_day"), table_name="usage_daily")
    op.drop_table("usage_daily")
    op.drop_index(op.f("ix_org_members_team_id"), table_name="org_members")
    op.drop_table("org_members")
    op.drop_table("usage_watermark")
    op.drop_index(op.f("ix_org_nodes_parent_id"), table_name="org_nodes")
    op.drop_table("org_nodes")
