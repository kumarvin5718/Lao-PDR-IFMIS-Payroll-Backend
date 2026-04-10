"""Dashboard aggregations (§10) — scoped like employee list, cached in Valkey."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from datetime import date
from typing import Any
from uuid import UUID

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models.app_user import AppUser
from app.models.dept_officer_scope import DeptOfficerScope
from app.models.employee import Employee
from app.models.manager_scope import ManagerScope
from app.models.payroll_monthly import PayrollMonthly
from app.schemas.auth import User
from app.utils.scope import employee_scope_clause, get_manager_scope
from app.utils.valkey import valkey_client


def cache_key(endpoint: str, user_id: str, dept: str | None, location: str | None) -> str:
    d = dept.strip() if dept else "_"
    loc = location.strip() if location else "_"
    return f"dashboard:{endpoint}:{user_id}:{d}:{loc}"


def cache_key_stat(endpoint: str, viewer_user_id: str, segment: str) -> str:
    """Single-segment cache key, e.g. dashboard:dept-stats:{user_id}:{dept}."""
    return f"dashboard:{endpoint}:{viewer_user_id}:{segment.strip()}"


async def cached_json(
    key: str,
    compute: Callable[[], Awaitable[dict[str, Any]]],
    ttl: int = 300,
) -> dict[str, Any]:
    raw = await valkey_client.get(key)
    if raw:
        return json.loads(raw)
    result = await compute()
    await valkey_client.set(key, json.dumps(result), ex=ttl)
    return result


async def employee_stats_totals(
    db: AsyncSession,
    wc: ColumnElement[bool] | None,
) -> dict[str, Any]:
    total_stmt = select(func.count()).select_from(Employee).where(Employee.is_active.is_(True))
    if wc is not None:
        total_stmt = total_stmt.where(wc)
    total = int(await db.scalar(total_stmt) or 0)

    complete_stmt = (
        select(func.count())
        .select_from(Employee)
        .where(Employee.is_active.is_(True))
        .where(Employee.is_complete.is_(True))
    )
    if wc is not None:
        complete_stmt = complete_stmt.where(wc)
    complete = int(await db.scalar(complete_stmt) or 0)

    incomplete = total - complete
    fill_rate_pct = round(100.0 * complete / total, 1) if total > 0 else 0.0
    return {
        "total": total,
        "complete": complete,
        "incomplete": incomplete,
        "fill_rate_pct": fill_rate_pct,
    }


async def dept_stats(
    db: AsyncSession,
    current_user: User,
    dept: str,
) -> dict[str, Any]:
    wc = await dashboard_employee_where(db, current_user, dept, None)
    return await employee_stats_totals(db, wc)


async def location_stats(
    db: AsyncSession,
    current_user: User,
    location: str,
) -> dict[str, Any]:
    wc = await dashboard_employee_where(db, current_user, None, location)
    return await employee_stats_totals(db, wc)


async def _manager_scope_rows(
    db: AsyncSession,
    manager_user_id: UUID,
) -> list[ManagerScope]:
    result = await db.execute(
        select(ManagerScope)
        .where(ManagerScope.user_id == manager_user_id)
        .where(ManagerScope.is_active.is_(True)),
    )
    return list(result.scalars().all())


async def _dept_officer_department_names(db: AsyncSession, user_id: str) -> list[str]:
    result = await db.execute(
        select(DeptOfficerScope.department_name)
        .where(DeptOfficerScope.user_id == UUID(user_id))
        .where(DeptOfficerScope.is_active.is_(True)),
    )
    return [r[0] for r in result.all()]


def _assert_manager_stats_access(
    current_user: User,
    manager_user_id: UUID,
    scope_rows: list[ManagerScope],
    officer_depts: list[str] | None,
) -> None:
    if current_user.role == "ROLE_ADMIN":
        return
    if current_user.role == "ROLE_MANAGER":
        if UUID(current_user.user_id) != manager_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ERR_AUTH_FORBIDDEN", "message": "Can only view your own manager stats"},
            )
        return
    if current_user.role == "ROLE_DEPT_OFFICER":
        if not officer_depts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ERR_SCOPE_NOT_FOUND", "message": "No department assigned to this officer"},
            )
        if scope_rows and not any(r.department_name in officer_depts for r in scope_rows):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ERR_AUTH_FORBIDDEN", "message": "Manager is outside your department scope"},
            )
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "ERR_AUTH_FORBIDDEN", "message": "Forbidden"},
    )


async def manager_stats(
    db: AsyncSession,
    current_user: User,
    manager_user_id: UUID,
) -> dict[str, Any]:
    scope_rows = await _manager_scope_rows(db, manager_user_id)
    officer_depts: list[str] | None = None
    if current_user.role == "ROLE_DEPT_OFFICER":
        officer_depts = await _dept_officer_department_names(db, current_user.user_id)

    _assert_manager_stats_access(current_user, manager_user_id, scope_rows, officer_depts)

    if not scope_rows:
        return {"total": 0, "complete": 0, "incomplete": 0, "fill_rate_pct": 0.0}

    pair_clause = or_(
        *[
            and_(Employee.service_province == r.location, Employee.department_name == r.department_name)
            for r in scope_rows
        ],
    )
    scope = await employee_scope_clause(db, current_user)
    if scope is None:
        wc: ColumnElement[bool] | None = pair_clause
    else:
        wc = and_(scope, pair_clause)

    return await employee_stats_totals(db, wc)


async def dashboard_employee_where(
    db: AsyncSession,
    current_user: User,
    dept: str | None,
    location: str | None,
) -> ColumnElement[bool] | None:
    scope = await employee_scope_clause(db, current_user)
    extras: list[ColumnElement[bool]] = []
    if dept and dept.strip():
        extras.append(Employee.department_name == dept.strip())
    if location and location.strip():
        extras.append(Employee.service_province == location.strip())
    if scope is None:
        if not extras:
            return None
        return and_(*extras)
    if not extras:
        return scope
    return and_(scope, *extras)


async def _pending_registration_scope(
    db: AsyncSession,
    current_user: User,
) -> ColumnElement[bool] | None:
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
            select(DeptOfficerScope.department_name)
            .where(DeptOfficerScope.user_id == UUID(current_user.user_id))
            .where(DeptOfficerScope.is_active.is_(True)),
        )
        depts = [r[0] for r in result.all()]
        if not depts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_SCOPE_NOT_FOUND",
                    "message": "No department assigned to this officer",
                },
            )
        return Employee.department_name.in_(depts)
    return None


async def count_pending_registrations(
    db: AsyncSession,
    current_user: User,
    dept: str | None,
    location: str | None,
) -> int:
    if current_user.role == "ROLE_EMPLOYEE":
        return 0
    stmt = (
        select(func.count())
        .select_from(AppUser)
        .join(Employee, Employee.email == AppUser.email)
        .where(AppUser.role == "ROLE_EMPLOYEE")
        .where(AppUser.registration_status == "PENDING")
    )
    pw = await _pending_registration_scope(db, current_user)
    if pw is not None:
        stmt = stmt.where(pw)
    if dept and dept.strip():
        stmt = stmt.where(Employee.department_name == dept.strip())
    if location and location.strip():
        stmt = stmt.where(Employee.service_province == location.strip())
    return int(await db.scalar(stmt) or 0)


async def get_summary(
    db: AsyncSession,
    current_user: User,
    dept: str | None,
    location: str | None,
) -> dict[str, Any]:
    wc = await dashboard_employee_where(db, current_user, dept, location)

    total_stmt = select(func.count()).select_from(Employee).where(Employee.is_active.is_(True))
    if wc is not None:
        total_stmt = total_stmt.where(wc)
    total_employees = int(await db.scalar(total_stmt) or 0)

    complete_stmt = (
        select(func.count())
        .select_from(Employee)
        .where(Employee.is_active.is_(True))
        .where(Employee.is_complete.is_(True))
    )
    if wc is not None:
        complete_stmt = complete_stmt.where(wc)
    complete_employees = int(await db.scalar(complete_stmt) or 0)

    if total_employees > 0:
        fill_rate_pct = round(100.0 * complete_employees / total_employees, 1)
    else:
        fill_rate_pct = 0.0

    pending_registrations = await count_pending_registrations(db, current_user, dept, location)

    gross_payroll_current = 0
    net_payroll_current = 0
    if current_user.role == "ROLE_ADMIN":
        today = date.today()
        month_d = date(today.year, today.month, 1)
        sum_stmt = (
            select(
                func.coalesce(func.sum(PayrollMonthly.gross_earnings_lak), 0),
                func.coalesce(func.sum(PayrollMonthly.net_salary_lak), 0),
            )
            .select_from(PayrollMonthly)
            .join(Employee, Employee.employee_code == PayrollMonthly.employee_code)
            .where(PayrollMonthly.payroll_month == month_d)
        )
        if wc is not None:
            sum_stmt = sum_stmt.where(wc)
        row = (await db.execute(sum_stmt)).one()
        gross_payroll_current = int(float(row[0]))
        net_payroll_current = int(float(row[1]))

    return {
        "total_employees": total_employees,
        "complete_employees": complete_employees,
        "fill_rate_pct": fill_rate_pct,
        "pending_registrations": pending_registrations,
        "gross_payroll_current": gross_payroll_current,
        "net_payroll_current": net_payroll_current,
    }


async def headcount_by_department(
    db: AsyncSession,
    current_user: User,
    dept: str | None,
    location: str | None,
) -> dict[str, Any]:
    wc = await dashboard_employee_where(db, current_user, dept, location)
    stmt = (
        select(Employee.department_name, func.count())
        .where(Employee.is_active.is_(True))
        .group_by(Employee.department_name)
        .order_by(func.count().desc())
    )
    if wc is not None:
        stmt = stmt.where(wc)
    result = await db.execute(stmt)
    rows = [{"department_name": r[0], "count": int(r[1])} for r in result.all()]
    return {"data": rows}


async def headcount_by_location(
    db: AsyncSession,
    current_user: User,
    dept: str | None,
    location: str | None,
) -> dict[str, Any]:
    wc = await dashboard_employee_where(db, current_user, dept, location)
    stmt = (
        select(Employee.service_province, func.count())
        .where(Employee.is_active.is_(True))
        .group_by(Employee.service_province)
        .order_by(func.count().desc())
    )
    if wc is not None:
        stmt = stmt.where(wc)
    result = await db.execute(stmt)
    rows = [{"location": r[0], "count": int(r[1])} for r in result.all()]
    return {"data": rows}


async def fill_rate_by_department(
    db: AsyncSession,
    current_user: User,
    dept: str | None,
    location: str | None,
) -> dict[str, Any]:
    wc = await dashboard_employee_where(db, current_user, dept, location)
    stmt = (
        select(
            Employee.department_name,
            func.coalesce(
                func.sum(case((Employee.is_complete.is_(True), 1), else_=0)),
                0,
            ),
            func.coalesce(
                func.sum(case((Employee.is_complete.is_(False), 1), else_=0)),
                0,
            ),
        )
        .where(Employee.is_active.is_(True))
        .group_by(Employee.department_name)
        .order_by(Employee.department_name.asc())
    )
    if wc is not None:
        stmt = stmt.where(wc)
    result = await db.execute(stmt)
    rows = [
        {"department_name": r[0], "complete": int(r[1]), "incomplete": int(r[2])}
        for r in result.all()
    ]
    return {"data": rows}


async def grade_distribution(
    db: AsyncSession,
    current_user: User,
    dept: str | None,
    location: str | None,
) -> dict[str, Any]:
    wc = await dashboard_employee_where(db, current_user, dept, location)
    stmt = (
        select(Employee.grade, func.count())
        .where(Employee.is_active.is_(True))
        .group_by(Employee.grade)
        .order_by(Employee.grade.asc())
    )
    if wc is not None:
        stmt = stmt.where(wc)
    result = await db.execute(stmt)
    rows = [{"grade": int(r[0]), "count": int(r[1])} for r in result.all()]
    return {"data": rows}


async def employment_mix(
    db: AsyncSession,
    current_user: User,
    dept: str | None,
    location: str | None,
) -> dict[str, Any]:
    wc = await dashboard_employee_where(db, current_user, dept, location)
    stmt = (
        select(Employee.employment_type, func.count())
        .where(Employee.is_active.is_(True))
        .group_by(Employee.employment_type)
        .order_by(func.count().desc())
    )
    if wc is not None:
        stmt = stmt.where(wc)
    result = await db.execute(stmt)
    rows = [{"employment_type": r[0], "count": int(r[1])} for r in result.all()]
    return {"data": rows}


async def payroll_trend(db: AsyncSession) -> dict[str, Any]:
    today = date.today()
    first_current = date(today.year, today.month, 1)
    months: list[date] = [first_current - relativedelta(months=i) for i in range(11, -1, -1)]

    out: list[dict[str, Any]] = []
    for month_d in months:
        q = (
            select(
                func.coalesce(func.sum(PayrollMonthly.gross_earnings_lak), 0),
                func.coalesce(func.sum(PayrollMonthly.net_salary_lak), 0),
                func.count(PayrollMonthly.employee_code),
            )
            .select_from(PayrollMonthly)
            .where(PayrollMonthly.payroll_month == month_d)
        )
        row = (await db.execute(q)).one()
        out.append(
            {
                "month": month_d.strftime("%Y-%m"),
                "gross": int(float(row[0])),
                "net": int(float(row[1])),
                "headcount": int(row[2]),
            },
        )
    return {"data": out}
