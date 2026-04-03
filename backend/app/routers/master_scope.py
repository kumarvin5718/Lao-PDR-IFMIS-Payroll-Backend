from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import (
    ROLE_ADMIN_ONLY,
    ROLE_ADMIN_OR_DEPT_OFFICER,
    ROLE_MANAGER_ONLY,
)
from app.schemas.master_scope import DeptOfficerScopeCreate, ManagerScopeCreate
from app.services import master_scope_service as mss

router = APIRouter(prefix="/master", tags=["master-scope"])


def _ok(data: object) -> dict:
    return {"success": True, "data": data, "pagination": None, "error": None}


@router.get("/manager-scope")
async def list_manager_scopes(
    current_user: ROLE_ADMIN_OR_DEPT_OFFICER,
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await mss.list_manager_scopes_for_user(db, current_user)
    return _ok(items)


@router.get("/manager-scope/my-scope")
async def list_my_manager_scope(
    current_user: ROLE_MANAGER_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await mss.list_manager_scopes_all_active_for_manager(db, UUID(current_user.user_id))
    return _ok(items)


@router.post("/manager-scope", status_code=status.HTTP_201_CREATED)
async def create_manager_scope(
    body: ManagerScopeCreate,
    current_user: ROLE_ADMIN_OR_DEPT_OFFICER,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await mss.create_manager_scope(
        db,
        current_user,
        body.user_id,
        body.location,
        body.department_name,
    )
    payload = await mss.manager_scope_row_dict(db, row)
    return _ok(payload)


@router.delete("/manager-scope/{scope_id}")
async def delete_manager_scope(
    scope_id: str,
    current_user: ROLE_ADMIN_OR_DEPT_OFFICER,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        sid = UUID(scope_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid scope id",
        ) from exc
    await mss.soft_delete_manager_scope(db, current_user, sid)
    return _ok({"message": "Scope removed."})


@router.get("/dept-officer-scope")
async def list_dept_officer_scopes(
    _user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await mss.list_dept_officer_scopes(db)
    return _ok(items)


@router.post("/dept-officer-scope", status_code=status.HTTP_201_CREATED)
async def create_dept_officer_scope(
    body: DeptOfficerScopeCreate,
    current_user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await mss.create_dept_officer_scope(db, current_user, body.user_id, body.department_name)
    payload = await mss.dept_officer_scope_row_dict(db, row)
    return _ok(payload)


@router.delete("/dept-officer-scope/{scope_id}")
async def delete_dept_officer_scope(
    scope_id: str,
    _user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        sid = UUID(scope_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid scope id",
        ) from exc
    await mss.soft_delete_dept_officer_scope(db, sid)
    return _ok({"message": "Scope removed."})
