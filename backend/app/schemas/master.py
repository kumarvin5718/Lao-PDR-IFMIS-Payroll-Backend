from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GradeStepOut(BaseModel):
    grade: int
    step: int
    basic_salary: float
    model_config = ConfigDict(from_attributes=True)


class GradeStepUpdate(BaseModel):
    basic_salary: float = Field(gt=0)


class AllowanceRateOut(BaseModel):
    allowance_name: str
    rate_type: str  # "FLAT" or "PCT"
    rate_value: float
    effective_date: date | None
    model_config = ConfigDict(from_attributes=True)


class AllowanceRateUpdate(BaseModel):
    rate_type: str | None = None
    rate_value: float | None = Field(default=None, gt=0)
    effective_date: date | None = None


class AllowanceRateCreate(BaseModel):
    allowance_name: str = Field(min_length=1, max_length=80)
    rate_type: str
    rate_value: float = Field(gt=0)
    effective_date: date | None = None

    @field_validator("rate_type")
    @classmethod
    def validate_rate_type(cls, v: str) -> str:
        if v.upper() not in ("FLAT", "PCT"):
            raise ValueError("rate_type must be FLAT or PCT")
        return v.upper()


class GradeDerivationOut(BaseModel):
    education_level: str
    min_exp_years: int
    derived_grade: int
    derived_step: int
    model_config = ConfigDict(from_attributes=True)


class GradeDerivationUpdate(BaseModel):
    derived_grade: int = Field(ge=1, le=10)
    derived_step: int = Field(ge=1, le=15)


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


class OrgOut(BaseModel):
    ministry_name: str
    dept_key: str
    dept_display_name: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class OrgCreate(BaseModel):
    ministry_name: str = Field(min_length=1)
    dept_key: str = Field(min_length=1)
    dept_display_name: str = Field(min_length=1)
    is_active: bool = True


class OrgUpdate(BaseModel):
    dept_display_name: str | None = None
    is_active: bool | None = None


class LocationOut(BaseModel):
    province: str
    region: str
    is_remote_area: bool
    is_hazardous_area: bool
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class LocationCreate(BaseModel):
    province: str = Field(min_length=1)
    region: str = Field(min_length=1)
    is_remote_area: bool = False
    is_hazardous_area: bool = False


class LocationUpdate(BaseModel):
    region: str | None = None
    is_remote_area: bool | None = None
    is_hazardous_area: bool | None = None
    is_active: bool | None = None


class BankOut(BaseModel):
    bank_name: str
    bank_code: str
    swift_code: str | None
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class BankCreate(BaseModel):
    bank_name: str = Field(min_length=1)
    bank_code: str = Field(min_length=1)
    swift_code: str | None = None
    is_active: bool = True


class BankUpdate(BaseModel):
    swift_code: str | None = None
    is_active: bool | None = None


class PITBracketOut(BaseModel):
    bracket_no: int
    lower_bound: float
    upper_bound: float | None
    rate_pct: float
    deduction_amount: float
    model_config = ConfigDict(from_attributes=True)


class PITBracketUpdate(BaseModel):
    lower_bound: float | None = Field(default=None, ge=0)
    upper_bound: float | None = None
    rate_pct: float | None = Field(default=None, ge=0, le=100)
    deduction_amount: float | None = Field(default=None, ge=0)
