from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PayrollMonthlyArchive(Base):
    __tablename__ = "payroll_monthly_archive"
    __table_args__ = (
        PrimaryKeyConstraint("employee_code", "payroll_month", "archived_at"),
        CheckConstraint("net_salary_lak >= 0", name="ck_payroll_arch_net_non_negative"),
        CheckConstraint(
            "approval_status IN ('PENDING','APPROVED','LOCKED')",
            name="ck_payroll_arch_approval_status",
        ),
    )

    employee_code: Mapped[str] = mapped_column(
        String(10),
        ForeignKey("employee.employee_code"),
        nullable=False,
    )
    payroll_month: Mapped[date] = mapped_column(Date, nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    step: Mapped[int] = mapped_column(Integer, nullable=False)
    grade_step_key: Mapped[str] = mapped_column(String(10), nullable=False)
    grade_step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    salary_index_rate: Mapped[float] = mapped_column(Numeric(10, 0), nullable=False)
    basic_salary_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False)
    position_allowance_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    years_service_allowance_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    teaching_allowance_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    medical_allowance_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    na_member_allowance_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    hazardous_allowance_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    remote_allowance_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    foreign_living_allow_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    fuel_benefit_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    spouse_benefit_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    child_benefit_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    other_allowance_1_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    other_allowance_1_desc: Mapped[str | None] = mapped_column(String(200))
    other_allowance_2_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    other_allowance_2_desc: Mapped[str | None] = mapped_column(String(200))
    other_allowance_3_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    other_allowance_3_desc: Mapped[str | None] = mapped_column(String(200))
    total_allowances_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False)
    gross_earnings_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False)
    sso_rate_ref: Mapped[str] = mapped_column(
        String(80),
        ForeignKey("lk_allowance_rates.allowance_name"),
        nullable=False,
    )
    sso_employee_contribution: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False)
    taxable_income_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False)
    applicable_bracket_no: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lk_pit_brackets.bracket_no"),
        nullable=False,
    )
    pit_amount_lak: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    addl_deduction_1_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    addl_deduction_1_desc: Mapped[str | None] = mapped_column(String(200))
    addl_deduction_2_lak: Mapped[float] = mapped_column(Numeric(14, 0), nullable=False, default=0)
    addl_deduction_2_desc: Mapped[str | None] = mapped_column(String(200))
    total_deductions_lak: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    net_salary_lak: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    approval_status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    approved_by: Mapped[str | None] = mapped_column(String(80))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    locked_by: Mapped[str | None] = mapped_column(String(80))
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    calculated_by: Mapped[str] = mapped_column(String(80), nullable=False)
    archived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    archive_reason: Mapped[str | None] = mapped_column(String(200))
