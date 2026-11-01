"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-01 14:25:49.983252
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
        "posts",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("author_id", sa.String(length=64), nullable=False),
        sa.Column("author_name", sa.String(length=200), nullable=False),
        sa.Column("author_role", sa.String(length=200), nullable=False),
        sa.Column("author_avatar", sa.String(length=16), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "tags", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column(
            "attachments", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("edited", sa.Boolean(), nullable=False),
        sa.Column("helpful_count", sa.Integer(), nullable=False),
        sa.Column("repost_count", sa.Integer(), nullable=False),
        sa.Column(
            "repost_of", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=True
        ),
        sa.Column(
            "visibility_ack",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_posts")),
    )
    op.create_index(op.f("ix_posts_author_id"), "posts", ["author_id"], unique=False)
    op.create_index(op.f("ix_posts_created_at"), "posts", ["created_at"], unique=False)
    op.create_table(
        "helpful_marks",
        sa.Column("post_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["post_id"], ["posts.id"], name=op.f("fk_helpful_marks_post_id_posts"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("post_id", "user_id", name=op.f("pk_helpful_marks")),
    )
    op.create_table(
        "replies",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("post_id", sa.String(length=64), nullable=False),
        sa.Column("author_id", sa.String(length=64), nullable=False),
        sa.Column("author_name", sa.String(length=200), nullable=False),
        sa.Column("author_role", sa.String(length=200), nullable=False),
        sa.Column("author_avatar", sa.String(length=16), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("edited", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], name=op.f("fk_replies_post_id_posts"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_replies")),
    )
    op.create_index(op.f("ix_replies_post_id"), "replies", ["post_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_replies_post_id"), table_name="replies")
    op.drop_table("replies")
    op.drop_table("helpful_marks")
    op.drop_index(op.f("ix_posts_created_at"), table_name="posts")
    op.drop_index(op.f("ix_posts_author_id"), table_name="posts")
    op.drop_table("posts")
