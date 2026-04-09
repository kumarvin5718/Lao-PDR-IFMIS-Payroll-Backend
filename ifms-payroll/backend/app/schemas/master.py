"""Master data request/response models (grades, banks, allowances, PIT, org)."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class GradeStepOut(BaseModel):
    grade: int
    step: int
    grade_step_key: str
    grade_step_index: int
    salary_index_rate: float
    min_education: str | None = None
    min_prior_experience_years: int | None = None
    basic_salary: float
    notes: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    last_updated: date | None = None
    last_updated_by: str | None = None
    circular_ref: str | None = None
    change_remarks: str | None = None
    model_config = ConfigDict(from_attributes=True)


class GradeStepUpdate(BaseModel):
    basic_salary: float = Field(gt=0)


class GradeDerivationOut(BaseModel):
    education_level: str
    min_exp_years: int
    exp_max_years: int | None = None
    derived_grade: int
    derived_step: int
    rule_description: str | None = None
    effective_from: date | None = None
    circular_ref: str | None = None
    model_config = ConfigDict(from_attributes=True)


class GradeDerivationUpdate(BaseModel):
    derived_grade: int = Field(ge=1, le=10)
    derived_step: int = Field(ge=1, le=15)
    rule_description: str | None = None


class GradeDerivationCreate(BaseModel):
    education_level: str = Field(min_length=1, max_length=40)
    min_exp_years: int = Field(ge=0, le=99)
    exp_max_years: int | None = Field(default=None, ge=0, le=99)
    derived_grade: int = Field(ge=1, le=10)
    derived_step: int = Field(ge=1, le=15)


class GradeDerivationQuery(BaseModel):
    education_level: str
    prior_experience_years: int
    years_of_service: int


def _normalise_field_allowance(v: object) -> str | None:
    if v in (None, "", "None", "none"):
        return None
    return v  # type: ignore[return-value]


class OrgOut(BaseModel):
    ministry_name: str
    ministry_key: str
    department_name: str
    department_key: str
    division_name: str | None
    profession_category: str
    na_allowance_eligible: bool
    field_allowance_type: str | None
    effective_from: date | None
    effective_to: date | None
    circular_ref: str | None
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

    @field_validator("field_allowance_type", mode="before")
    @classmethod
    def normalise_field_allowance(cls, v: object) -> str | None:
        return _normalise_field_allowance(v)


class OrgCreate(BaseModel):
    ministry_name: str = Field(min_length=1)
    ministry_key: str = Field(min_length=1)
    department_name: str = Field(min_length=1)
    department_key: str = Field(min_length=1)
    division_name: str | None = None
    profession_category: str = Field(
        default="Administration",
        pattern="^(Teacher|Medical|Finance|Administration|Technical|Legal|Diplomatic|General)$",
    )
    na_allowance_eligible: bool = False
    field_allowance_type: str | None = Field(
        default=None,
        pattern="^(Teaching|Medical)$",
    )
    effective_from: date | None = None
    effective_to: date | None = None
    circular_ref: str | None = None
    change_remarks: str | None = None

    @field_validator("field_allowance_type", mode="before")
    @classmethod
    def normalise_field_allowance(cls, v: object) -> str | None:
        return _normalise_field_allowance(v)

    @model_validator(mode="after")
    def clear_field_allowance_for_non_teacher_medical(self) -> OrgCreate:
        if self.profession_category not in ("Teacher", "Medical"):
            object.__setattr__(self, "field_allowance_type", None)
        return self


class OrgUpdate(BaseModel):
    department_name: str | None = None
    division_name: str | None = None
    profession_category: str | None = Field(
        default=None,
        pattern="^(Teacher|Medical|Finance|Administration|Technical|Legal|Diplomatic|General)$",
    )
    na_allowance_eligible: bool | None = None
    field_allowance_type: str | None = Field(
        default=None,
        pattern="^(Teaching|Medical)$",
    )
    effective_from: date | None = None
    effective_to: date | None = None
    circular_ref: str | None = None
    change_remarks: str | None = None
    is_active: bool | None = None

    @field_validator("field_allowance_type", mode="before")
    @classmethod
    def normalise_field_allowance(cls, v: object) -> str | None:
        return _normalise_field_allowance(v)


class LocationOut(BaseModel):
    district_key: str
    country: str
    country_key: str
    province_key: str
    province: str
    district: str
    is_remote_area: bool
    is_hazardous_area: bool
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class LocationCreate(BaseModel):
    district_key: str = Field(min_length=1)
    country: str = Field(min_length=1)
    country_key: str = Field(min_length=1)
    province_key: str = Field(min_length=1)
    province: str = Field(min_length=1)
    district: str = Field(min_length=1)
    is_remote_area: bool = False
    is_hazardous_area: bool = False


class LocationUpdate(BaseModel):
    district: str | None = None
    is_remote_area: bool | None = None
    is_hazardous_area: bool | None = None
    is_active: bool | None = None


class BankOut(BaseModel):
    bank_name: str
    bank_key: str
    branch_name: str
    bank_code: str
    swift_code: str | None
    is_active: bool
    category: str | None = None
    bank_abbrev: str | None = None
    city: str | None = None
    branch_address: str | None = None
    bank_hq_address: str | None = None
    telephone: str | None = None
    ownership: str | None = None
    established: str | None = None
    website: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    last_updated: date | None = None
    last_updated_by: str | None = None
    circular_ref: str | None = None
    change_remarks: str | None = None
    model_config = ConfigDict(from_attributes=True)


class BankCreate(BaseModel):
    bank_name: str = Field(min_length=1)
    bank_code: str = Field(min_length=1)
    swift_code: str | None = None
    is_active: bool = True
    branch_name: str | None = Field(default=None, max_length=60)
    category: str | None = None
    bank_abbrev: str | None = None
    city: str | None = None
    branch_address: str | None = None
    bank_hq_address: str | None = None
    telephone: str | None = None
    ownership: str | None = None
    established: str | None = None
    website: str | None = None


class BankUpdate(BaseModel):
    swift_code: str | None = None
    is_active: bool | None = None
    category: str | None = None
    bank_abbrev: str | None = None
    city: str | None = None
    branch_address: str | None = None
    bank_hq_address: str | None = None
    telephone: str | None = None
    ownership: str | None = None
    established: str | None = None
    website: str | None = None
    circular_ref: str | None = None
    change_remarks: str | None = None


class PITBracketOut(BaseModel):
    bracket_no: int
    lower_bound: float
    upper_bound: float | None
    rate_pct: float
    deduction_amount: float
    description: str | None = None
    effective_from: date | None = None
    circular_ref: str | None = None
    model_config = ConfigDict(from_attributes=True)


class PITBracketUpdate(BaseModel):
    lower_bound: float | None = Field(default=None, ge=0)
    upper_bound: float | None = None
    rate_pct: float | None = Field(default=None, ge=0, le=100)
    deduction_amount: float | None = Field(default=None, ge=0)
    description: str | None = None
