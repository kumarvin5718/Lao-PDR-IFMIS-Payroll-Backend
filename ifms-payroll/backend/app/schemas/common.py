"""Standard API envelope (`StandardResponse`, pagination helpers)."""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorResponse(BaseModel):
    code: str
    message: str
    field: str | None = None


class PaginatedResponse(BaseModel):
    page: int
    limit: int
    total: int
    pages: int


class StandardResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    pagination: PaginatedResponse | None = None
    error: ErrorResponse | None = None


class ErrorEnvelope(BaseModel):
    """Wrapper for HTTPException detail matching API contract."""

    success: bool = False
    data: None = None
    pagination: None = None
    error: ErrorResponse
