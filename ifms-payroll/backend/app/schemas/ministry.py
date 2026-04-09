"""Pydantic schemas for ministry master."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class MinistryOut(BaseModel):
    ministry_key: str
    ministry_name: str
    profession_category: str | None = None
    na_allowance_eligible: bool
    field_allowance_type: str | None = None
    effective_from: date | None = None
    circular_ref: str | None = None

    model_config = ConfigDict(from_attributes=True)


class MinistryCreate(BaseModel):
    ministry_key: str = Field(min_length=1, max_length=20)
    ministry_name: str = Field(min_length=1)
    profession_category: str | None = None
    na_allowance_eligible: bool = False
    field_allowance_type: str | None = None
    effective_from: date | None = None
    circular_ref: str | None = None


class MinistryUpdate(BaseModel):
    ministry_name: str | None = None
    profession_category: str | None = None
    na_allowance_eligible: bool | None = None
    field_allowance_type: str | None = None
    effective_from: date | None = None
    circular_ref: str | None = None
