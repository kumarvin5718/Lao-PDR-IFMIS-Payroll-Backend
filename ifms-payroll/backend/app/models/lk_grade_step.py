"""Lookup: base salary steps per grade (MoF grade/step matrix)."""

from datetime import date

from sqlalchemy import CheckConstraint, Computed, Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LkGradeStep(Base):
    __tablename__ = "lk_grade_step"
    __table_args__ = (
        CheckConstraint("grade BETWEEN 1 AND 6", name="ck_lk_gs_grade"),
        CheckConstraint("step BETWEEN 1 AND 15", name="ck_lk_gs_step"),
        CheckConstraint("grade_step_index > 0", name="ck_lk_gs_index"),
    )

    grade: Mapped[int] = mapped_column(Integer, primary_key=True)
    step: Mapped[int] = mapped_column(Integer, primary_key=True)
    grade_step_key: Mapped[str] = mapped_column(
        String(10),
        Computed(
            "'G' || LPAD(grade::TEXT, 2, '0') || '-S' || LPAD(step::TEXT, 2, '0')",
            persisted=True,
        ),
    )
    grade_step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    salary_index_rate: Mapped[float] = mapped_column(Numeric(10, 0), nullable=False, default=10000)
    min_education: Mapped[str | None] = mapped_column(String(40))
    min_prior_experience_years: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(String(200))
    effective_from: Mapped[date | None] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    last_updated: Mapped[date | None] = mapped_column(Date)
    last_updated_by: Mapped[str | None] = mapped_column(String(80))
    circular_ref: Mapped[str | None] = mapped_column(String(80))
    change_remarks: Mapped[str | None] = mapped_column(String(200))
