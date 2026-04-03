import re

from pydantic import BaseModel, Field, field_validator


_SSO_RE = re.compile(r"^SSO\d{7}$")


class RegistrationRequest(BaseModel):
    sso_number: str = Field(..., min_length=10, max_length=10)
    full_name: str = Field(..., min_length=2)
    email: str
    phone_number: str | None = None
    location: str = Field(..., min_length=1)
    department_name: str = Field(..., min_length=1)

    @field_validator("sso_number")
    @classmethod
    def validate_sso(cls, v: str) -> str:
        if not _SSO_RE.match(v):
            raise ValueError("SSO number must match pattern SSO + 7 digits")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not v:
            return v
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Invalid email address format")
        v = v.lower()
        if not v.endswith("@gov.la"):
            raise ValueError("Email must end with @gov.la")
        return v


class RegistrationResponse(BaseModel):
    message: str
    employee_code: str


class RejectRegistrationBody(BaseModel):
    reason: str | None = None
