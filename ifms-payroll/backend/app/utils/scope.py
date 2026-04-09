"""Query-time scope for Manager / Department Officer / Employee (Phase 4)."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.models.app_user import AppUser
from app.models.dept_officer_scope import DeptOfficerScope
from app.models.employee import Employee
from app.models.manager_scope import ManagerScope
from app.schemas.auth import User


async def get_manager_scope(db: AsyncSession, user_id: str) -> list[dict[str, str]]:
    """Returns list of {location, department_name} for a ROLE_MANAGER user."""
    uid = UUID(user_id) if isinstance(user_id, str) else user_id
    result = await db.execute(
        select(ManagerScope)
        .where(ManagerScope.user_id == uid)
        .where(ManagerScope.is_active.is_(True)),
    )
    rows = result.scalars().all()
    return [{"location": r.location, "department_name": r.department_name} for r in rows]


async def employee_scope_clause(
    db: AsyncSession,
    current_user: User,
) -> ColumnElement[bool] | None:
    """
    Returns a SQLAlchemy boolean expression to filter Employee rows, or None for no extra filter (admin).
    """
    if current_user.role == "ROLE_ADMIN":
        return None

    if current_user.role == "ROLE_MANAGER":
        scope = await get_manager_scope(db, current_user.user_id)
        if not scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_SCOPE_NOT_FOUND",
                    "message": "No scope assigned to this manager",
                },
            )
        return or_(
            *[
                and_(
                    Employee.service_province == s["location"],
                    Employee.department_name == s["department_name"],
                )
                for s in scope
            ],
        )

    if current_user.role == "ROLE_DEPT_OFFICER":
        result = await db.execute(
            select(DeptOfficerScope)
            .where(DeptOfficerScope.user_id == UUID(current_user.user_id))
            .where(DeptOfficerScope.is_active.is_(True)),
        )
        depts = [r.department_name for r in result.scalars().all()]
        if not depts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_SCOPE_NOT_FOUND",
                    "message": "No department assigned to this officer",
                },
            )
        return Employee.department_name.in_(depts)

    if current_user.role == "ROLE_EMPLOYEE":
        uid = UUID(current_user.user_id)
        user_row = await db.scalar(select(AppUser).where(AppUser.user_id == uid))
        if user_row is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ERR_AUTH_FORBIDDEN", "message": "Forbidden"},
            )
        return or_(
            Employee.uploaded_by_user_id == uid,
            func.lower(Employee.email) == user_row.email.lower(),
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "ERR_AUTH_FORBIDDEN", "message": "Forbidden"},
    )


def apply_scope_to_select(
    stmt: Select,
    scope_clause: ColumnElement[bool] | None,
) -> Select:
    if scope_clause is None:
        return stmt
    return stmt.where(scope_clause)


async def assert_employee_accessible(
    db: AsyncSession,
    emp: Employee,
    current_user: User,
) -> None:
    """Raises 403 if current_user cannot access this employee row."""
    if current_user.role == "ROLE_ADMIN":
        return
    if current_user.role == "ROLE_EMPLOYEE":
        uid = UUID(current_user.user_id)
        if emp.uploaded_by_user_id == uid:
            return
        user_row = await db.scalar(select(AppUser).where(AppUser.user_id == uid))
        if user_row is not None and emp.email.lower() == user_row.email.lower():
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ERR_AUTH_MINISTRY_SCOPE",
                "message": "Employee is outside your scope",
            },
        )
    if current_user.role == "ROLE_MANAGER":
        scope = await get_manager_scope(db, current_user.user_id)
        if not scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ERR_SCOPE_NOT_FOUND", "message": "No scope assigned to this manager"},
            )
        if not any(
            emp.service_province == s["location"] and emp.department_name == s["department_name"] for s in scope
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_AUTH_MINISTRY_SCOPE",
                    "message": "Employee is outside your scope",
                },
            )
        return
    if current_user.role == "ROLE_DEPT_OFFICER":
        result = await db.execute(
            select(DeptOfficerScope.department_name)
            .where(DeptOfficerScope.user_id == UUID(current_user.user_id))
            .where(DeptOfficerScope.is_active.is_(True)),
        )
        depts = [r[0] for r in result.all()]
        if not depts or emp.department_name not in depts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_AUTH_MINISTRY_SCOPE",
                    "message": "Employee is outside your scope",
                },
            )
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ERR_AUTH_FORBIDDEN")


async def manager_can_edit_employee(
    db: AsyncSession,
    emp: Employee,
    current_user: User,
) -> bool:
    """True if ROLE_MANAGER may edit this employee (in scope)."""
    if current_user.role != "ROLE_MANAGER":
        return False
    scope = await get_manager_scope(db, current_user.user_id)
    return any(
        emp.service_province == s["location"] and emp.department_name == s["department_name"] for s in scope
    )


def get_manager_scope_sync(db: Session, user_id: str) -> list[dict[str, str]]:
    uid = UUID(user_id) if isinstance(user_id, str) else user_id
    result = db.execute(
        select(ManagerScope)
        .where(ManagerScope.user_id == uid)
        .where(ManagerScope.is_active.is_(True)),
    )
    rows = result.scalars().all()
    return [{"location": r.location, "department_name": r.department_name} for r in rows]


def employee_scope_clause_sync(db: Session, current_user: User) -> ColumnElement[bool] | None:
    """Sync scope filter for Celery / blocking exports (same rules as ``employee_scope_clause``)."""
    if current_user.role == "ROLE_ADMIN":
        return None

    if current_user.role == "ROLE_MANAGER":
        scope = get_manager_scope_sync(db, current_user.user_id)
        if not scope:
            raise RuntimeError("ERR_SCOPE_NOT_FOUND")
        return or_(
            *[
                and_(
                    Employee.service_province == s["location"],
                    Employee.department_name == s["department_name"],
                )
                for s in scope
            ],
        )

    if current_user.role == "ROLE_DEPT_OFFICER":
        result = db.execute(
            select(DeptOfficerScope)
            .where(DeptOfficerScope.user_id == UUID(current_user.user_id))
            .where(DeptOfficerScope.is_active.is_(True)),
        )
        depts = [r.department_name for r in result.scalars().all()]
        if not depts:
            raise RuntimeError("ERR_SCOPE_NOT_FOUND")
        return Employee.department_name.in_(depts)

    if current_user.role == "ROLE_EMPLOYEE":
        uid = UUID(current_user.user_id)
        user_row = db.scalar(select(AppUser).where(AppUser.user_id == uid))
        if user_row is None:
            raise RuntimeError("ERR_AUTH_FORBIDDEN")
        return or_(
            Employee.uploaded_by_user_id == uid,
            func.lower(Employee.email) == user_row.email.lower(),
        )

    raise RuntimeError("ERR_AUTH_FORBIDDEN")
