"""Allowance rate (lk_allowance_rates) API models."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AllowanceRateOut(BaseModel):
    allowance_name: str
    rate_type: str  # "FLAT" or "PCT"
    rate_value: float
    effective_date: date | None
    eligibility: str | None = None
    description: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    circular_ref: str | None = None
    change_remarks: str | None = None
    model_config = ConfigDict(from_attributes=True)


class AllowanceRateUpdate(BaseModel):
    rate_type: str | None = None
    rate_value: float | None = Field(default=None, ge=0)
    effective_date: date | None = None
    eligibility: str | None = None
    description: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    circular_ref: str | None = None
    change_remarks: str | None = None


class AllowanceRateCreate(BaseModel):
    allowance_name: str = Field(min_length=1, max_length=80)
    rate_type: str
    rate_value: float = Field(ge=0)  # 0 allowed (e.g. fuel policy placeholder)
    effective_date: date | None = None
    eligibility: str | None = None
    description: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    circular_ref: str | None = None
    change_remarks: str | None = None

    @field_validator("rate_type")
    @classmethod
    def validate_rate_type(cls, v: str) -> str:
        if v.upper() not in ("FLAT", "PCT"):
            raise ValueError("rate_type must be FLAT or PCT")
        return v.upper()
