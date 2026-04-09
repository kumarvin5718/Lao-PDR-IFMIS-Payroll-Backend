"""Lookup: ministry master (MoF circular list)."""

from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class LkMinistryMaster(Base):
    __tablename__ = "lk_ministry_master"
    __table_args__ = (
        CheckConstraint(
            "field_allowance_type IS NULL OR field_allowance_type IN ('Teaching','Medical')",
            name="ck_lk_ministry_field_allowance_type",
        ),
    )

    ministry_key: Mapped[str] = mapped_column(String(20), primary_key=True)
    ministry_name: Mapped[str] = mapped_column(Text, nullable=False)
    profession_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    na_allowance_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    field_allowance_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    circular_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
