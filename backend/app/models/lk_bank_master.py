"""Lookup: bank names and codes for employee salary accounts."""

from datetime import date

from sqlalchemy import Date, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LkBankMaster(Base):
    __tablename__ = "lk_bank_master"
    __table_args__ = (PrimaryKeyConstraint("bank_name", "branch_name"),)

    bank_name: Mapped[str] = mapped_column(String(70), nullable=False)
    bank_key: Mapped[str] = mapped_column(String(6), nullable=False)
    branch_name: Mapped[str] = mapped_column(String(60), nullable=False)
    branch_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    swift_code: Mapped[str] = mapped_column(String(12), nullable=False)
    category: Mapped[str | None] = mapped_column(String(120))
    bank_abbrev: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(100))
    branch_address: Mapped[str | None] = mapped_column(String(500))
    bank_hq_address: Mapped[str | None] = mapped_column(String(500))
    telephone: Mapped[str | None] = mapped_column(String(80))
    ownership: Mapped[str | None] = mapped_column(String(300))
    established: Mapped[str | None] = mapped_column(String(30))
    website: Mapped[str | None] = mapped_column(String(300))
    effective_from: Mapped[date | None] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    last_updated: Mapped[date | None] = mapped_column(Date)
    last_updated_by: Mapped[str | None] = mapped_column(String(80))
    circular_ref: Mapped[str | None] = mapped_column(String(80))
    change_remarks: Mapped[str | None] = mapped_column(String(200))
