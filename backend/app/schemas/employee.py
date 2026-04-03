import re
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

EmploymentType = Literal["Permanent", "Probationary", "Contract", "Intern"]
Title = Literal["Mr.", "Ms.", "Mrs.", "Dr.", "Prof."]
Gender = Literal["Male", "Female", "Other"]
FieldAllowanceType = Literal["Teaching", "Medical", "None"]

_CODE_RE = re.compile(r"^LAO\d{5}$")


class EmployeeCreate(BaseModel):
    employee_code: Optional[str] = None
    title: Title
    first_name: str
    last_name: str
    gender: Gender
    date_of_birth: date
    email: str
    mobile_number: Optional[str] = None
    date_of_joining: date
    employment_type: EmploymentType = "Permanent"
    position_title: str
    education_level: str
    prior_experience_years: int = Field(default=0, ge=0, le=40)
    grade: int = Field(ge=1, le=10)
    step: int = Field(ge=1, le=15)
    civil_service_card_id: str
    sso_number: Optional[str] = None
    ministry_name: str
    department_name: str
    division_name: Optional[str] = None
    service_country: str = "Lao PDR"
    service_province: str
    service_district: Optional[str] = None
    profession_category: str
    is_remote_area: bool = False
    is_foreign_posting: bool = False
    is_hazardous_area: bool = False
    house_no: Optional[str] = None
    street: Optional[str] = None
    area_baan: Optional[str] = None
    province_of_residence: Optional[str] = None
    pin_code: Optional[str] = None
    residence_country: Optional[str] = None
    bank_name: str
    bank_branch: str
    bank_branch_code: Optional[str] = None
    bank_account_no: str
    swift_code: Optional[str] = None
    has_spouse: bool = False
    eligible_children: int = Field(default=0, ge=0, le=3)
    position_level: str
    is_na_member: bool = False
    field_allowance_type: FieldAllowanceType = "None"
    is_active: bool = True

    @field_validator("employee_code", mode="before")
    @classmethod
    def validate_employee_code(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        if not _CODE_RE.match(s):
            raise ValueError("employee_code must match pattern LAO#####")
        return s

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v:
            return v
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Invalid email address format")
        return v.lower()


class EmployeeBatchBody(BaseModel):
    """Online grid / batch create — each item validated as ``EmployeeCreate`` per row."""

    employees: list[dict] = Field(max_length=200)


class EmployeeUpdate(BaseModel):
    title: Optional[Title] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[Gender] = None
    date_of_birth: Optional[date] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    date_of_joining: Optional[date] = None
    employment_type: Optional[EmploymentType] = None
    position_title: Optional[str] = None
    education_level: Optional[str] = None
    prior_experience_years: Optional[int] = Field(default=None, ge=0, le=40)
    grade: Optional[int] = Field(default=None, ge=1, le=10)
    step: Optional[int] = Field(default=None, ge=1, le=15)
    civil_service_card_id: Optional[str] = None
    sso_number: Optional[str] = None
    ministry_name: Optional[str] = None
    department_name: Optional[str] = None
    division_name: Optional[str] = None
    service_country: Optional[str] = None
    service_province: Optional[str] = None
    service_district: Optional[str] = None
    profession_category: Optional[str] = None
    is_remote_area: Optional[bool] = None
    is_foreign_posting: Optional[bool] = None
    is_hazardous_area: Optional[bool] = None
    house_no: Optional[str] = None
    street: Optional[str] = None
    area_baan: Optional[str] = None
    province_of_residence: Optional[str] = None
    pin_code: Optional[str] = None
    residence_country: Optional[str] = None
    bank_name: Optional[str] = None
    bank_branch: Optional[str] = None
    bank_branch_code: Optional[str] = None
    bank_account_no: Optional[str] = None
    swift_code: Optional[str] = None
    has_spouse: Optional[bool] = None
    eligible_children: Optional[int] = Field(default=None, ge=0, le=3)
    position_level: Optional[str] = None
    is_na_member: Optional[bool] = None
    field_allowance_type: Optional[FieldAllowanceType] = None
    is_active: Optional[bool] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, s):
            raise ValueError("Invalid email address format")
        return s.lower()


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_code: str
    title: str
    first_name: str
    last_name: str
    gender: str
    date_of_birth: date
    email: str
    mobile_number: Optional[str]
    date_of_joining: date
    employment_type: str
    position_title: str
    education_level: str
    prior_experience_years: int
    grade: int
    step: int
    civil_service_card_id: str
    sso_number: Optional[str]
    ministry_name: str
    department_name: str
    division_name: Optional[str]
    service_country: str
    service_province: str
    service_district: Optional[str]
    profession_category: str
    is_remote_area: bool
    is_foreign_posting: bool
    is_hazardous_area: bool
    house_no: Optional[str]
    street: Optional[str]
    area_baan: Optional[str]
    province_of_residence: Optional[str]
    pin_code: Optional[str]
    residence_country: Optional[str]
    bank_name: str
    bank_branch: str
    bank_branch_code: Optional[str]
    bank_account_no: str
    swift_code: Optional[str]
    has_spouse: bool
    eligible_children: int
    position_level: str
    is_na_member: bool
    field_allowance_type: str
    is_active: bool
    created_at: datetime
    created_by: str
    updated_at: Optional[datetime]
    updated_by: Optional[str]

    @computed_field
    @property
    def full_name(self) -> str:
        return f"{self.title} {self.first_name} {self.last_name}".strip()

    @computed_field
    @property
    def years_of_service(self) -> int:
        return (date.today() - self.date_of_joining).days // 365

    @computed_field
    @property
    def date_of_retirement(self) -> date:
        d = self.date_of_birth
        try:
            return d.replace(year=d.year + 60)
        except ValueError:
            return date(d.year + 60, 3, 1)


class EmployeeListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    employee_code: str
    email: str
    ministry_name: str
    grade: int
    step: int
    position_title: str
    employment_type: str
    is_active: bool
    date_of_joining: date
    owner_role: str | None = None
    uploaded_by_user_id: str | None = None
    service_province: str | None = None
    department_name: str | None = None
    title: str = Field(exclude=True)
    first_name: str = Field(exclude=True)
    last_name: str = Field(exclude=True)

    @field_validator("uploaded_by_user_id", mode="before")
    @classmethod
    def _uuid_uploaded_by(cls, v: object) -> str | None:
        if v is None:
            return None
        return str(v)

    @computed_field
    @property
    def full_name(self) -> str:
        return f"{self.title} {self.first_name} {self.last_name}".strip()


class EmployeeListResponse(BaseModel):
    items: list[EmployeeListItem]
    total: int
    page: int
    limit: int
    pages: int
