from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Employee(Base):
    __tablename__ = "employee"
    __table_args__ = (
        CheckConstraint(
            "title IN ('Mr.','Ms.','Mrs.','Dr.','Prof.')",
            name="ck_emp_title",
        ),
        CheckConstraint("gender IN ('Male','Female','Other')", name="ck_emp_gender"),
        CheckConstraint(
            "employment_type IN ('Permanent','Probationary','Contract','Intern')",
            name="ck_emp_employment_type",
        ),
        CheckConstraint(
            "prior_experience_years >= 0 AND prior_experience_years <= 40",
            name="ck_emp_prior_exp",
        ),
        CheckConstraint("grade BETWEEN 1 AND 6", name="ck_emp_grade"),
        CheckConstraint("step BETWEEN 1 AND 15", name="ck_emp_step"),
        CheckConstraint("eligible_children BETWEEN 0 AND 3", name="ck_emp_children"),
        CheckConstraint(
            "field_allowance_type IN ('Teaching','Medical','None')",
            name="ck_emp_field_allowance_type",
        ),
        Index(
            "uq_employee_sso_number_partial",
            "sso_number",
            unique=True,
            postgresql_where=text("sso_number IS NOT NULL"),
        ),
        ForeignKeyConstraint(
            ["bank_name", "bank_branch"],
            ["lk_bank_master.bank_name", "lk_bank_master.branch_name"],
            name="fk_employee_bank_branch",
        ),
        CheckConstraint(
            "registration_status IN ('PENDING','ACTIVE','REJECTED')",
            name="employee_registration_status_check",
        ),
    )

    employee_code: Mapped[str] = mapped_column(String(10), primary_key=True)
    title: Mapped[str] = mapped_column(String(10), nullable=False)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    gender: Mapped[str] = mapped_column(String(6), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    mobile_number: Mapped[str | None] = mapped_column(String(20))
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=False)
    employment_type: Mapped[str] = mapped_column(String(15), nullable=False, default="Permanent")
    position_title: Mapped[str] = mapped_column(String(100), nullable=False)
    education_level: Mapped[str] = mapped_column(String(40), nullable=False)
    prior_experience_years: Mapped[int] = mapped_column(Integer, default=0)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    step: Mapped[int] = mapped_column(Integer, nullable=False)
    civil_service_card_id: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    sso_number: Mapped[str | None] = mapped_column(String(12))
    ministry_name: Mapped[str] = mapped_column(String(80), nullable=False)
    department_name: Mapped[str] = mapped_column(String(80), nullable=False)
    division_name: Mapped[str | None] = mapped_column(String(60))
    service_country: Mapped[str] = mapped_column(String(30), nullable=False, default="Lao PDR")
    service_province: Mapped[str] = mapped_column(
        String(60),
        ForeignKey("lk_location_master.province"),
        nullable=False,
    )
    service_district: Mapped[str | None] = mapped_column(String(60))
    profession_category: Mapped[str] = mapped_column(String(20), nullable=False)
    is_remote_area: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_foreign_posting: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_hazardous_area: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    house_no: Mapped[str | None] = mapped_column(String(30))
    street: Mapped[str | None] = mapped_column(String(100))
    area_baan: Mapped[str | None] = mapped_column(String(80))
    province_of_residence: Mapped[str | None] = mapped_column(String(60))
    pin_code: Mapped[str | None] = mapped_column(String(10))
    residence_country: Mapped[str | None] = mapped_column(String(60))
    bank_name: Mapped[str] = mapped_column(String(70), nullable=False)
    bank_branch: Mapped[str] = mapped_column(String(60), nullable=False)
    bank_branch_code: Mapped[str | None] = mapped_column(String(10))
    bank_account_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    swift_code: Mapped[str | None] = mapped_column(String(12))
    has_spouse: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    eligible_children: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    position_level: Mapped[str] = mapped_column(
        String(80),
        ForeignKey("lk_allowance_rates.allowance_name"),
        nullable=False,
    )
    is_na_member: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    field_allowance_type: Mapped[str] = mapped_column(String(10), nullable=False, default="None")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    created_by: Mapped[str] = mapped_column(String(80), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[str | None] = mapped_column(String(80))
    uploaded_by_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("app_user.user_id"),
        nullable=True,
    )
    owner_role: Mapped[str | None] = mapped_column(String(30))
    is_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    registration_status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
