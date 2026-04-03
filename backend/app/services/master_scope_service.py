"""Manager scope and department officer scope CRUD (Phase 4 Slice 3)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_user import AppUser
from app.models.dept_officer_scope import DeptOfficerScope
from app.models.lk_location_master import LkLocationMaster
from app.models.lk_org_master import LkOrgMaster
from app.models.manager_scope import ManagerScope
from app.schemas.auth import User


async def _dept_officer_department_names(db: AsyncSession, user_id: UUID) -> list[str]:
    result = await db.execute(
        select(DeptOfficerScope.department_name)
        .where(DeptOfficerScope.user_id == user_id)
        .where(DeptOfficerScope.is_active.is_(True)),
    )
    return [r[0] for r in result.all()]


async def validate_manager_user(db: AsyncSession, user_id: UUID) -> AppUser:
    u = await db.scalar(select(AppUser).where(AppUser.user_id == user_id))
    if u is None or u.role != "ROLE_MANAGER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ERR_MANAGER_USER_INVALID",
                "message": "user_id must be an app_user with role ROLE_MANAGER",
            },
        )
    return u


async def validate_dept_officer_user(db: AsyncSession, user_id: UUID) -> AppUser:
    u = await db.scalar(select(AppUser).where(AppUser.user_id == user_id))
    if u is None or u.role != "ROLE_DEPT_OFFICER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ERR_OFFICER_USER_INVALID",
                "message": "user_id must be an app_user with role ROLE_DEPT_OFFICER",
            },
        )
    return u


async def validate_province(db: AsyncSession, province: str) -> None:
    ok = await db.scalar(select(LkLocationMaster.province).where(LkLocationMaster.province == province))
    if ok is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_EMP_FK_PROVINCE", "message": "Invalid location / province"},
        )


async def validate_department_name(db: AsyncSession, department_name: str) -> None:
    ok = await db.scalar(
        select(LkOrgMaster.department_name).where(LkOrgMaster.department_name == department_name).limit(1),
    )
    if ok is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_EMP_FK_MINISTRY", "message": "Invalid department"},
        )


async def list_manager_scopes_for_user(db: AsyncSession, current_user: User) -> list[dict]:
    stmt = (
        select(ManagerScope, AppUser.username, AppUser.full_name)
        .join(AppUser, AppUser.user_id == ManagerScope.user_id)
        .order_by(ManagerScope.created_at.desc())
    )
    if current_user.role == "ROLE_DEPT_OFFICER":
        depts = await _dept_officer_department_names(db, UUID(current_user.user_id))
        if not depts:
            return []
        stmt = stmt.where(ManagerScope.department_name.in_(depts))

    result = await db.execute(stmt)
    rows = result.all()
    out: list[dict] = []
    for ms, username, full_name in rows:
        out.append(
            {
                "id": str(ms.id),
                "user_id": str(ms.user_id),
                "username": username,
                "full_name": full_name,
                "location": ms.location,
                "department_name": ms.department_name,
                "is_active": ms.is_active,
                "created_at": ms.created_at.isoformat() if ms.created_at else None,
            },
        )
    return out


async def list_manager_scopes_all_active_for_manager(
    db: AsyncSession,
    manager_user_id: UUID,
) -> list[dict]:
    result = await db.execute(
        select(ManagerScope)
        .where(ManagerScope.user_id == manager_user_id)
        .where(ManagerScope.is_active.is_(True))
        .order_by(ManagerScope.location.asc(), ManagerScope.department_name.asc()),
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(ms.id),
            "location": ms.location,
            "department_name": ms.department_name,
            "is_active": ms.is_active,
        }
        for ms in rows
    ]


async def create_manager_scope(
    db: AsyncSession,
    current_user: User,
    user_id: UUID,
    location: str,
    department_name: str,
) -> ManagerScope:
    await validate_manager_user(db, user_id)
    await validate_province(db, location)
    await validate_department_name(db, department_name)

    if current_user.role == "ROLE_DEPT_OFFICER":
        allowed = await _dept_officer_department_names(db, UUID(current_user.user_id))
        if department_name not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_AUTH_FORBIDDEN",
                    "message": "Cannot assign scope outside your department assignments",
                },
            )

    existing = await db.scalar(
        select(ManagerScope).where(
            ManagerScope.user_id == user_id,
            ManagerScope.location == location,
            ManagerScope.department_name == department_name,
        ),
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MANAGER_SCOPE_DUPLICATE", "message": "Manager scope already exists"},
        )

    created_by = (current_user.full_name or "system")[:80]
    row = ManagerScope(
        user_id=user_id,
        location=location,
        department_name=department_name,
        is_active=True,
        created_by=created_by,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def manager_scope_row_dict(db: AsyncSession, ms: ManagerScope) -> dict:
    u = await db.scalar(select(AppUser).where(AppUser.user_id == ms.user_id))
    return {
        "id": str(ms.id),
        "user_id": str(ms.user_id),
        "username": u.username if u else "",
        "full_name": u.full_name if u else "",
        "location": ms.location,
        "department_name": ms.department_name,
        "is_active": ms.is_active,
        "created_at": ms.created_at.isoformat() if ms.created_at else None,
    }


async def dept_officer_scope_row_dict(db: AsyncSession, dos: DeptOfficerScope) -> dict:
    u = await db.scalar(select(AppUser).where(AppUser.user_id == dos.user_id))
    return {
        "id": str(dos.id),
        "user_id": str(dos.user_id),
        "username": u.username if u else "",
        "full_name": u.full_name if u else "",
        "department_name": dos.department_name,
        "is_active": dos.is_active,
        "created_at": dos.created_at.isoformat() if dos.created_at else None,
    }


async def soft_delete_manager_scope(
    db: AsyncSession,
    current_user: User,
    scope_id: UUID,
) -> None:
    ms = await db.scalar(select(ManagerScope).where(ManagerScope.id == scope_id))
    if ms is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_NOT_FOUND", "message": "Scope not found"},
        )
    if current_user.role == "ROLE_DEPT_OFFICER":
        allowed = await _dept_officer_department_names(db, UUID(current_user.user_id))
        if ms.department_name not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ERR_AUTH_FORBIDDEN", "message": "Cannot remove scope outside your department"},
            )
    ms.is_active = False
    await db.commit()


async def list_dept_officer_scopes(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(DeptOfficerScope, AppUser.username, AppUser.full_name)
        .join(AppUser, AppUser.user_id == DeptOfficerScope.user_id)
        .order_by(DeptOfficerScope.created_at.desc()),
    )
    rows = result.all()
    out: list[dict] = []
    for dos, username, full_name in rows:
        out.append(
            {
                "id": str(dos.id),
                "user_id": str(dos.user_id),
                "username": username,
                "full_name": full_name,
                "department_name": dos.department_name,
                "is_active": dos.is_active,
                "created_at": dos.created_at.isoformat() if dos.created_at else None,
            },
        )
    return out


async def create_dept_officer_scope(
    db: AsyncSession,
    current_user: User,
    user_id: UUID,
    department_name: str,
) -> DeptOfficerScope:
    _ = current_user
    await validate_dept_officer_user(db, user_id)
    await validate_department_name(db, department_name)

    existing = await db.scalar(
        select(DeptOfficerScope).where(
            DeptOfficerScope.user_id == user_id,
            DeptOfficerScope.department_name == department_name,
        ),
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MANAGER_SCOPE_DUPLICATE", "message": "Department officer scope already exists"},
        )

    created_by = (current_user.full_name or "system")[:80]
    row = DeptOfficerScope(
        user_id=user_id,
        department_name=department_name,
        is_active=True,
        created_by=created_by,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def soft_delete_dept_officer_scope(db: AsyncSession, scope_id: UUID) -> None:
    dos = await db.scalar(select(DeptOfficerScope).where(DeptOfficerScope.id == scope_id))
    if dos is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_NOT_FOUND", "message": "Scope not found"},
        )
    dos.is_active = False
    await db.commit()


async def list_users_by_role(db: AsyncSession, role: str) -> list[dict]:
    result = await db.execute(
        select(AppUser)
        .where(AppUser.role == role)
        .order_by(AppUser.username.asc()),
    )
    rows = result.scalars().all()
    return [
        {
            "user_id": str(u.user_id),
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "is_active": u.is_active,
        }
        for u in rows
    ]
