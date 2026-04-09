"""Lookup: allowance type rates by grade/step or effective dates."""

from datetime import date

from sqlalchemy import CheckConstraint, Date, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LkAllowanceRates(Base):
    __tablename__ = "lk_allowance_rates"
    __table_args__ = (CheckConstraint("amount_or_rate >= 0", name="ck_lk_ar_amount"),)

    allowance_name: Mapped[str] = mapped_column(String(80), primary_key=True)
    amount_or_rate: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    eligibility: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    effective_from: Mapped[date | None] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    last_updated: Mapped[date | None] = mapped_column(Date)
    last_updated_by: Mapped[str | None] = mapped_column(String(80))
    circular_ref: Mapped[str | None] = mapped_column(Text)
    change_remarks: Mapped[str | None] = mapped_column(Text)
