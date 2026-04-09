"""Manager scope and department officer scope CRUD (Phase 4 Slice 3)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import String, and_, cast, func, or_, select, update
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


async def _manager_scope_row_by_natural_key(
    db: AsyncSession,
    user_id: UUID,
    location: str,
    department_name: str,
) -> ManagerScope | None:
    """Any row matching the DB unique (user_id, location, department_name), active or not."""
    return await db.scalar(
        select(ManagerScope).where(
            ManagerScope.user_id == user_id,
            ManagerScope.location == location,
            ManagerScope.department_name == department_name,
        ),
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


async def list_manager_scopes_paginated(
    db: AsyncSession,
    current_user: User,
    *,
    search: str | None,
    page: int,
    size: int,
    active_only: bool,
) -> dict:
    conds: list = []
    if current_user.role == "ROLE_DEPT_OFFICER":
        depts = await _dept_officer_department_names(db, UUID(current_user.user_id))
        if not depts:
            return {"items": [], "total": 0, "page": page, "size": size, "pages": 0}
        conds.append(ManagerScope.department_name.in_(depts))
    if active_only:
        conds.append(ManagerScope.is_active.is_(True))
    if search and search.strip():
        term = f"%{search.strip()}%"
        conds.append(
            or_(
                AppUser.username.ilike(term),
                AppUser.full_name.ilike(term),
                ManagerScope.location.ilike(term),
                ManagerScope.department_name.ilike(term),
                cast(ManagerScope.user_id, String).ilike(term),
                cast(ManagerScope.id, String).ilike(term),
            )
        )
    where_clause = and_(*conds) if conds else None

    count_stmt = (
        select(func.count()).select_from(ManagerScope).join(AppUser, AppUser.user_id == ManagerScope.user_id)
    )
    if where_clause is not None:
        count_stmt = count_stmt.where(where_clause)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = (
        select(ManagerScope, AppUser.username, AppUser.full_name)
        .join(AppUser, AppUser.user_id == ManagerScope.user_id)
        .order_by(ManagerScope.created_at.desc())
    )
    if where_clause is not None:
        stmt = stmt.where(where_clause)
    stmt = stmt.offset((page - 1) * size).limit(size)
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
    pages = (total + size - 1) // size if size > 0 else 0
    return {"items": out, "total": total, "page": page, "size": size, "pages": pages}


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


async def list_manager_scopes_for_user(
    db: AsyncSession,
    current_user: User,
    user_id: UUID,
) -> list[dict]:
    """Active scope rows for one manager (for edit form). Dept officers only see rows in their departments."""
    await validate_manager_user(db, user_id)

    stmt = (
        select(ManagerScope)
        .where(ManagerScope.user_id == user_id)
        .where(ManagerScope.is_active.is_(True))
        .order_by(ManagerScope.location.asc(), ManagerScope.department_name.asc())
    )
    if current_user.role == "ROLE_DEPT_OFFICER":
        allowed = await _dept_officer_department_names(db, UUID(current_user.user_id))
        if not allowed:
            return []
        stmt = stmt.where(ManagerScope.department_name.in_(allowed))

    result = await db.execute(stmt)
    rows = result.scalars().all()
    out: list[dict] = []
    for ms in rows:
        out.append(await manager_scope_row_dict(db, ms))
    return out


async def replace_manager_scopes_for_user(
    db: AsyncSession,
    current_user: User,
    user_id: UUID,
    scopes_list: list[tuple[str, str]],
) -> dict:
    """Soft-delete existing active scope(s), then insert the new set. Admin: all scopes for user.
    Dept officer: only removes/re-adds rows in departments they manage; other departments unchanged."""
    await validate_manager_user(db, user_id)

    seen_keys: set[tuple[str, str]] = set()
    unique_ordered: list[tuple[str, str]] = []
    for loc, dept in scopes_list:
        location = loc.strip()
        department_name = dept.strip()
        if not location or not department_name:
            continue
        key = (location, department_name)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        unique_ordered.append(key)

    if not unique_ordered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ERR_MANAGER_SCOPE_BATCH_EMPTY",
                "message": "At least one valid location and department pair is required",
            },
        )

    if current_user.role == "ROLE_DEPT_OFFICER":
        allowed = await _dept_officer_department_names(db, UUID(current_user.user_id))
        for location, department_name in unique_ordered:
            if department_name not in allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "code": "ERR_AUTH_FORBIDDEN",
                        "message": "Cannot assign scope outside your department assignments",
                    },
                )
        await db.execute(
            update(ManagerScope)
            .where(ManagerScope.user_id == user_id)
            .where(ManagerScope.is_active.is_(True))
            .where(ManagerScope.department_name.in_(allowed))
            .values(is_active=False),
        )
    else:
        await db.execute(
            update(ManagerScope)
            .where(ManagerScope.user_id == user_id)
            .where(ManagerScope.is_active.is_(True))
            .values(is_active=False),
        )
    await db.commit()

    return await create_manager_scopes_batch(db, current_user, user_id, unique_ordered)


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

    existing_any = await _manager_scope_row_by_natural_key(db, user_id, location, department_name)
    if existing_any is not None:
        if existing_any.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "ERR_MANAGER_SCOPE_DUPLICATE", "message": "Manager scope already exists"},
            )
        created_by = (current_user.full_name or "system")[:80]
        existing_any.is_active = True
        existing_any.created_by = created_by
        await db.commit()
        await db.refresh(existing_any)
        return existing_any

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


async def create_manager_scopes_batch(
    db: AsyncSession,
    current_user: User,
    user_id: UUID,
    scopes_list: list[tuple[str, str]],
) -> dict:
    """Insert many scope rows for one manager; skips duplicates (same user + location + department)."""
    await validate_manager_user(db, user_id)

    seen_keys: set[tuple[str, str]] = set()
    unique_ordered: list[tuple[str, str]] = []
    for loc, dept in scopes_list:
        location = loc.strip()
        department_name = dept.strip()
        if not location or not department_name:
            continue
        key = (location, department_name)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        unique_ordered.append(key)

    if not unique_ordered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ERR_MANAGER_SCOPE_BATCH_EMPTY",
                "message": "At least one valid location and department pair is required",
            },
        )

    skipped_duplicates = 0
    created_by = (current_user.full_name or "system")[:80]
    created_rows: list[ManagerScope] = []

    for location, department_name in unique_ordered:
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

        existing_any = await _manager_scope_row_by_natural_key(db, user_id, location, department_name)
        if existing_any is not None:
            if existing_any.is_active:
                skipped_duplicates += 1
                continue
            existing_any.is_active = True
            existing_any.created_by = created_by
            created_rows.append(existing_any)
            continue

        row = ManagerScope(
            user_id=user_id,
            location=location,
            department_name=department_name,
            is_active=True,
            created_by=created_by,
        )
        db.add(row)
        created_rows.append(row)

    await db.commit()
    for row in created_rows:
        await db.refresh(row)

    items = [await manager_scope_row_dict(db, r) for r in created_rows]
    return {
        "created": len(created_rows),
        "skipped_duplicates": skipped_duplicates,
        "items": items,
    }


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


async def list_dept_officer_scopes_paginated(
    db: AsyncSession,
    *,
    search: str | None,
    page: int,
    size: int,
    active_only: bool,
) -> dict:
    conds: list = []
    if active_only:
        conds.append(DeptOfficerScope.is_active.is_(True))
    if search and search.strip():
        term = f"%{search.strip()}%"
        conds.append(
            or_(
                AppUser.username.ilike(term),
                AppUser.full_name.ilike(term),
                DeptOfficerScope.department_name.ilike(term),
                cast(DeptOfficerScope.user_id, String).ilike(term),
                cast(DeptOfficerScope.id, String).ilike(term),
            )
        )
    where_clause = and_(*conds) if conds else None

    count_stmt = (
        select(func.count())
        .select_from(DeptOfficerScope)
        .join(AppUser, AppUser.user_id == DeptOfficerScope.user_id)
    )
    if where_clause is not None:
        count_stmt = count_stmt.where(where_clause)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = (
        select(DeptOfficerScope, AppUser.username, AppUser.full_name)
        .join(AppUser, AppUser.user_id == DeptOfficerScope.user_id)
        .order_by(DeptOfficerScope.created_at.desc())
    )
    if where_clause is not None:
        stmt = stmt.where(where_clause)
    stmt = stmt.offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
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
    pages = (total + size - 1) // size if size > 0 else 0
    return {"items": out, "total": total, "page": page, "size": size, "pages": pages}


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
