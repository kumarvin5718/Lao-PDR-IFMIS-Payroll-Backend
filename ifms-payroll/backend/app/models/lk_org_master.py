"""Lookup: ministry / department / unit org tree."""

from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LkOrgMaster(Base):
    __tablename__ = "lk_org_master"
    __table_args__ = (
        PrimaryKeyConstraint("ministry_name", "department_key"),
        CheckConstraint(
            "profession_category IN ('Teacher','Medical','Finance','Administration','Technical','Legal','Diplomatic','General')",
            name="ck_lk_org_profession_category",
        ),
        CheckConstraint(
            "field_allowance_type IS NULL OR field_allowance_type IN ('Teaching','Medical')",
            name="ck_lk_org_field_allowance_type",
        ),
    )

    ministry_name: Mapped[str] = mapped_column(String(80), nullable=False)
    ministry_key: Mapped[str] = mapped_column(String(10), nullable=False)
    department_name: Mapped[str] = mapped_column(String(80), nullable=False)
    department_key: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    division_name: Mapped[str | None] = mapped_column(String(60))
    profession_category: Mapped[str] = mapped_column(String(20), nullable=False)
    na_allowance_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    field_allowance_type: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)
    effective_from: Mapped[date | None] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    last_updated: Mapped[date | None] = mapped_column(Date)
    last_updated_by: Mapped[str | None] = mapped_column(String(80))
    circular_ref: Mapped[str | None] = mapped_column(String(80))
    change_remarks: Mapped[str | None] = mapped_column(String(200))
