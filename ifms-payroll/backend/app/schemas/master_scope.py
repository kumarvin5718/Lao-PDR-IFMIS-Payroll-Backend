"""DTOs for manager and department-officer scope rows."""

from uuid import UUID

from pydantic import BaseModel, Field


class ManagerScopeCreate(BaseModel):
    user_id: UUID
    location: str = Field(..., min_length=1, max_length=60)
    department_name: str = Field(..., min_length=1, max_length=80)


class ManagerScopeItem(BaseModel):
    location: str = Field(..., min_length=1, max_length=60)
    department_name: str = Field(..., min_length=1, max_length=80)


class ManagerScopeBatchCreate(BaseModel):
    """Create many (location, department) pairs for one manager in one request."""

    user_id: UUID
    scopes: list[ManagerScopeItem] = Field(..., min_length=1, max_length=200)


class ManagerScopeReplaceBody(BaseModel):
    """Replace active scope rows for a manager (see router for admin vs dept officer behaviour)."""

    scopes: list[ManagerScopeItem] = Field(..., min_length=1, max_length=200)


class DeptOfficerScopeCreate(BaseModel):
    user_id: UUID
    department_name: str = Field(..., min_length=1, max_length=80)
