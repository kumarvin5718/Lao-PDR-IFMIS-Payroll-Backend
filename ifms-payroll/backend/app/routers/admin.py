"""Admin-only: user CRUD, registration approvals, system utilities."""

from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import ROLE_ADMIN_ONLY, ROLE_ADMIN_OR_DEPT_OFFICER, ROLE_FINANCE_PLUS
from app.models.app_login_history import AppLoginHistory
from app.models.system_job_log import SystemJobLog
from app.schemas.system_job import SystemJobLogOut
from app.schemas.registration import RejectRegistrationBody
from app.schemas.user import LoginHistoryItem, UserCreate, UserUpdate
from app.services import master_scope_service as mss
from app.services import registration_service as reg_svc
from app.services import user_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _ok(data: object, pagination: dict | None = None) -> dict:
    return {"success": True, "data": data, "pagination": pagination, "error": None}


def _paginated_ok(items: list, *, page: int, limit: int, total: int) -> dict:
    pages = (total + limit - 1) // limit if limit > 0 else 0
    return _ok(
        items,
        pagination={"page": page, "limit": limit, "total": total, "pages": pages},
    )


@router.get("/users-by-role")
async def users_by_role(
    _current_user: ROLE_ADMIN_OR_DEPT_OFFICER,
    db: AsyncSession = Depends(get_db),
    role: str = Query(..., description="ROLE_MANAGER or ROLE_DEPT_OFFICER"),
) -> dict:
    _ = _current_user
    if role not in ("ROLE_MANAGER", "ROLE_DEPT_OFFICER"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ERR_VALIDATION", "message": "role must be ROLE_MANAGER or ROLE_DEPT_OFFICER"},
        )
    items = await mss.list_users_by_role(db, role)
    return _ok(items)


@router.get("/users")
async def list_users(
    _user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    rows, total = await user_service.list_users(db, page, limit)
    items = [user_service.user_to_list_item(r).model_dump(mode="json") for r in rows]
    return _paginated_ok(items, page=page, limit=limit, total=total)


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    _user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user, temp_password = await user_service.create_user(db, payload)
    out = user_service.user_to_out(user)
    return _ok(
        {
            "user": out.model_dump(mode="json"),
            "temp_password": temp_password,
            "message": "User created. Temporary password is shown once — store it securely.",
        }
    )


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    payload: UserUpdate,
    _user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await user_service.update_user(db, user_id, payload)
    out = user_service.user_to_out(user)
    return _ok(out.model_dump(mode="json"))


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    _user: ROLE_ADMIN_ONLY,
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    plain = await user_service.reset_password(db, user_id)
    return _ok(
        {
            "temp_password": plain,
            "message": "Password reset. Temporary password is shown once — store it securely.",
        }
    )


@router.get("/users/{user_id}/login-history")
async def user_login_history(
    _user: ROLE_ADMIN_ONLY,
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid user id") from None

    result = await db.execute(
        select(AppLoginHistory)
        .where(AppLoginHistory.user_id == uid)
        .order_by(AppLoginHistory.login_at.desc())
        .limit(500),
    )
    rows = result.scalars().all()
    items = [LoginHistoryItem.model_validate(r).model_dump(mode="json") for r in rows]
    return _ok(items)


@router.get("/registrations")
async def list_pending_registrations(
    current_user: ROLE_FINANCE_PLUS,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    items, total = await reg_svc.list_pending_registrations(db, current_user, page, limit)
    return _paginated_ok(items, page=page, limit=limit, total=total)


@router.post("/registrations/{user_id}/approve")
async def approve_registration(
    user_id: str,
    current_user: ROLE_FINANCE_PLUS,
    db: AsyncSession = Depends(get_db),
) -> dict:
    temp_password = await reg_svc.approve_registration(db, current_user, user_id)
    return _ok(
        {
            "message": "User approved.",
            "temp_password": temp_password,
        },
    )


@router.post("/registrations/{user_id}/reject")
async def reject_registration(
    user_id: str,
    current_user: ROLE_FINANCE_PLUS,
    db: AsyncSession = Depends(get_db),
    body: RejectRegistrationBody | None = Body(None),
) -> dict:
    _ = body
    await reg_svc.reject_registration(db, current_user, user_id)
    return _ok({"message": "Registration rejected."})


@router.get("/system-jobs")
async def get_system_jobs(
    _user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(SystemJobLog).order_by(SystemJobLog.started_at.desc()).limit(50),
    )
    rows = result.scalars().all()
    items = [SystemJobLogOut.model_validate(r).model_dump(mode="json") for r in rows]
    return _ok(items)
