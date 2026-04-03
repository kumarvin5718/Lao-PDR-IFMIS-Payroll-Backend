import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{4,60}$")

VALID_ROLES = [
    "ROLE_EMPLOYEE",
    "ROLE_MANAGER",
    "ROLE_DEPT_OFFICER",
    "ROLE_ADMIN",
]


class UserCreate(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    role: str
    preferred_language: str = "en"

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        if not _USERNAME_RE.match(v):
            raise ValueError("username must be 4–60 chars: letters, digits, underscore only")
        return v

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {VALID_ROLES}")
        return v

    @field_validator("preferred_language")
    @classmethod
    def lang_valid(cls, v: str) -> str:
        if v not in ("en", "lo"):
            raise ValueError("preferred_language must be 'en' or 'lo'")
        return v


class UserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None
    preferred_language: str | None = None

    @field_validator("role")
    @classmethod
    def role_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {VALID_ROLES}")
        return v

    @field_validator("preferred_language")
    @classmethod
    def lang_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in ("en", "lo"):
            raise ValueError("preferred_language must be 'en' or 'lo'")
        return v


class UserOut(BaseModel):
    user_id: str
    username: str
    full_name: str
    email: str
    role: str
    preferred_language: str
    is_active: bool
    force_password_change: bool
    last_login: datetime | None

    model_config = ConfigDict(from_attributes=True)


class UserListItem(BaseModel):
    """Row shape for GET /admin/users (list view)."""

    user_id: str
    username: str
    full_name: str
    email: str
    role: str
    preferred_language: str
    is_active: bool
    last_login: datetime | None

    model_config = ConfigDict(from_attributes=True)


class LoginHistoryItem(BaseModel):
    id: int
    login_at: datetime
    ip_address: str | None = None
    user_agent: str | None = None

    model_config = ConfigDict(from_attributes=True)
