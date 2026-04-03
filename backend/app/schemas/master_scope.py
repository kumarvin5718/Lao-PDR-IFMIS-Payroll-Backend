from uuid import UUID

from pydantic import BaseModel, Field


class ManagerScopeCreate(BaseModel):
    user_id: UUID
    location: str = Field(..., min_length=1, max_length=60)
    department_name: str = Field(..., min_length=1, max_length=80)


class DeptOfficerScopeCreate(BaseModel):
    user_id: UUID
    department_name: str = Field(..., min_length=1, max_length=80)
