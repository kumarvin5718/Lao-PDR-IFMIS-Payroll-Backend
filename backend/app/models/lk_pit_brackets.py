from datetime import date

from sqlalchemy import CheckConstraint, Date, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LkPitBrackets(Base):
    __tablename__ = "lk_pit_brackets"
    __table_args__ = (
        CheckConstraint("income_from_lak >= 0", name="ck_lk_pit_from"),
        CheckConstraint("rate_pct >= 0 AND rate_pct <= 100", name="ck_lk_pit_rate"),
        CheckConstraint("income_to_lak > income_from_lak", name="ck_lk_pit_range"),
    )

    bracket_no: Mapped[int] = mapped_column(Integer, primary_key=True)
    income_from_lak: Mapped[float] = mapped_column(Numeric(15, 0), nullable=False)
    income_to_lak: Mapped[float] = mapped_column(Numeric(15, 0), nullable=False)
    rate_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    cumulative_tax_lak: Mapped[float] = mapped_column(Numeric(15, 0), nullable=False, default=0)
    description: Mapped[str | None] = mapped_column(String(100))
    effective_from: Mapped[date | None] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)
    last_updated: Mapped[date | None] = mapped_column(Date)
    last_updated_by: Mapped[str | None] = mapped_column(String(80))
    circular_ref: Mapped[str | None] = mapped_column(String(80))
    change_remarks: Mapped[str | None] = mapped_column(String(200))
