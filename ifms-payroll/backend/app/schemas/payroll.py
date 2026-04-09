"""Payroll run, patch, lock, and approval request bodies."""

import re
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


class PayrollRunRequest(BaseModel):
    month: str
    ministry_filter: str | None = None

    @field_validator("month")
    @classmethod
    def validate_month(cls, v: str) -> str:
        if not _MONTH_RE.match(v):
            raise ValueError("month must be YYYY-MM")
        return v


class PayrollFreeFieldPatch(BaseModel):
    free_allowance_1: Decimal | None = None
    free_allowance_2: Decimal | None = None
    free_allowance_3: Decimal | None = None
    free_deduction_1: Decimal | None = None
    free_deduction_2: Decimal | None = None


class PayrollMonthlyOut(BaseModel):
    employee_code: str
    payroll_month: str
    grade: int = 1
    step: int = 1
    basic_salary: Decimal
    allowance_position: Decimal
    allowance_technical: Decimal
    allowance_remote: Decimal
    allowance_hazardous: Decimal
    allowance_foreign: Decimal
    allowance_spouse: Decimal
    allowance_children: Decimal
    allowance_teaching: Decimal
    allowance_medical: Decimal
    allowance_na: Decimal
    allowance_housing: Decimal
    allowance_transport: Decimal
    free_allowance_1: Decimal
    free_allowance_2: Decimal
    free_allowance_3: Decimal
    gross_salary: Decimal
    employee_sso: Decimal
    employer_sso: Decimal
    taxable_income: Decimal
    pit_amount: Decimal
    free_deduction_1: Decimal
    free_deduction_2: Decimal
    net_salary: Decimal
    status: str
    approved_by: str | None
    approved_at: datetime | None
    locked_at: datetime | None
    created_by: str
    created_at: datetime
    updated_at: datetime | None
    full_name: str | None = None
    ministry_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PayrollApproveRequest(BaseModel):
    month: str
    ministry: str | None = None
    employee_code: str | None = None  # if set, approve only this row (same month)

    @field_validator("month")
    @classmethod
    def validate_month(cls, v: str) -> str:
        if not _MONTH_RE.match(v):
            raise ValueError("month must be YYYY-MM")
        return v


class PayrollLockRequest(BaseModel):
    month: str

    @field_validator("month")
    @classmethod
    def validate_month(cls, v: str) -> str:
        if not _MONTH_RE.match(v):
            raise ValueError("month must be YYYY-MM")
        return v


class PayrollUnlockRequest(BaseModel):
    month: str
    reason: str = Field(min_length=5)

    @field_validator("month")
    @classmethod
    def validate_month(cls, v: str) -> str:
        if not _MONTH_RE.match(v):
            raise ValueError("month must be YYYY-MM")
        return v


class PayrollJobStatus(BaseModel):
    job_id: str
    status: str
    progress: int
    total: int
    processed: int
    error: str | None = None
