from datetime import date

from sqlalchemy import Date, Double, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from portal_kit.db import JsonDocument, metadata


class Base(DeclarativeBase):
    metadata = metadata()


class OrgNodeRecord(Base):
    __tablename__ = "org_nodes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    level: Mapped[int] = mapped_column(SmallInteger)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("org_nodes.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)


class MemberRecord(Base):
    __tablename__ = "org_members"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(120))
    team_id: Mapped[str] = mapped_column(ForeignKey("org_nodes.id"), index=True)
    tools: Mapped[list[str]] = mapped_column(JsonDocument, default=list)
    model_share: Mapped[dict[str, float]] = mapped_column(JsonDocument, default=dict)
    tokens_per_request: Mapped[float] = mapped_column(Double)
    peak_share: Mapped[float] = mapped_column(Double)
    first_seen: Mapped[date | None] = mapped_column(Date)


class DailyUsageRecord(Base):
    """Daily rollup of the hourly gateway events: requests in work hours and in quiet hours."""

    __tablename__ = "usage_daily"

    member_id: Mapped[str] = mapped_column(ForeignKey("org_members.id"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True, index=True)
    work_requests: Mapped[float] = mapped_column(Double)
    quiet_requests: Mapped[float] = mapped_column(Double)


class WatermarkRecord(Base):
    """Last day the rollup job has fully ingested."""

    __tablename__ = "usage_watermark"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    through_day: Mapped[date] = mapped_column(Date)
