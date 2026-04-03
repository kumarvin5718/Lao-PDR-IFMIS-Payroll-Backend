from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKeyConstraint, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LkGradeDerivation(Base):
    __tablename__ = "lk_grade_derivation"
    __table_args__ = (
        CheckConstraint("exp_min_years >= 0", name="ck_lk_gd_exp_min"),
        CheckConstraint("exp_max_years >= exp_min_years", name="ck_lk_gd_exp_range"),
        ForeignKeyConstraint(
            ["derived_grade", "derived_step"],
            ["lk_grade_step.grade", "lk_grade_step.step"],
            onupdate="NO ACTION",
            ondelete="RESTRICT",
        ),
    )

    education_level: Mapped[str] = mapped_column(String(40), primary_key=True)
    exp_min_years: Mapped[int] = mapped_column(Integer, primary_key=True)
    exp_max_years: Mapped[int] = mapped_column(Integer, nullable=False)
    derived_grade: Mapped[int] = mapped_column(Integer, nullable=False)
    derived_step: Mapped[int] = mapped_column(Integer, nullable=False)
    rule_description: Mapped[str | None] = mapped_column(String(200))
    effective_from: Mapped[date | None] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    last_updated: Mapped[date | None] = mapped_column(Date)
    last_updated_by: Mapped[str | None] = mapped_column(String(80))
    circular_ref: Mapped[str | None] = mapped_column(String(80))
    change_remarks: Mapped[str | None] = mapped_column(String(200))
