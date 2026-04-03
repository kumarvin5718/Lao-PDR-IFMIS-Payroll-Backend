from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    force_password_change: bool = False


class UserOut(BaseModel):
    user_id: str
    full_name: str
    role: str
    preferred_language: str
    email: str = ""


class User(BaseModel):
    """JWT-derived user; used in dependencies."""

    user_id: str
    full_name: str
    role: str
    preferred_language: str = "en"
    email: str = ""


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1)
