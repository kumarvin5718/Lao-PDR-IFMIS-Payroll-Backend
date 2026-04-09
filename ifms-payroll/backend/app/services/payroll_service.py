"""Payroll calculation engine — monthly run, list, patch, approve, lock, unlock."""

from __future__ import annotations

import math
import re
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Employee, LkAllowanceRates, LkGradeStep, LkPitBrackets, PayrollMonthly
from app.schemas.auth import User
from app.services.payroll_calculator import (
    allowance_rate_kind,
    basic_salary_lak,
    employee_sso_lak,
    employer_sso_lak,
    gross_earnings_lak,
    lak as _lak,
    net_salary_lak,
    taxable_income_lak,
    total_allowances_lak,
    total_deductions_lak,
    years_completed_as_of,
    yos_allowance_lak,
    yos_band_rate_name_for_years,
)
from app.utils.pit_calc import compute_pit_progressive
from app.utils.audit_session import set_audit_change_remarks
from app.utils.scope import assert_employee_accessible, employee_scope_clause, get_manager_scope
from app.utils.valkey import invalidate_dashboard_cache
from app.schemas.payroll import (
    PayrollApproveRequest,
    PayrollFreeFieldPatch,
    PayrollLockRequest,
    PayrollMonthlyOut,
    PayrollRunRequest,
    PayrollUnlockRequest,
)

_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


def _month_to_date(month: str) -> date:
    if not _MONTH_RE.match(month):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ERR_VALIDATION", "message": "Invalid month format"},
        )
    y, m = map(int, month.split("-"))
    return date(y, m, 1)


async def _get_allowance_rate(
    db: AsyncSession,
    allowance_name: str,
    basic_salary: Decimal,
) -> Decimal:
    row = await db.scalar(select(LkAllowanceRates).where(LkAllowanceRates.allowance_name == allowance_name))
    if row is None:
        return Decimal("0")
    rt = allowance_rate_kind(row.allowance_name, row.eligibility)
    amt = Decimal(str(row.amount_or_rate))
    if rt == "PCT":
        # Stored as decimal fraction (e.g. 0.20 = 20%) or legacy whole percent (20 = 20%)
        if amt <= 1:
            return _lak(basic_salary * amt)
        return _lak(basic_salary * (amt / Decimal("100")))
    return _lak(amt)


async def _calc_years_service_allowance(
    db: AsyncSession,
    date_of_joining: date,
    payroll_month_first: date,
) -> Decimal:
    """SRS §8.4: banded LAK/year × completed years (rates from lk_allowance_rates)."""
    years = years_completed_as_of(date_of_joining, payroll_month_first)
    if years <= 0:
        return Decimal("0")
    name = yos_band_rate_name_for_years(years)
    rate = await _get_allowance_rate(db, name, Decimal("0"))
    return yos_allowance_lak(years, rate)


async def _calculate_pit_and_bracket(
    db: AsyncSession,
    taxable_income: Decimal,
) -> tuple[Decimal, int]:
    res = await db.execute(select(LkPitBrackets).order_by(LkPitBrackets.bracket_no.asc()))
    brackets = list(res.scalars().all())
    return compute_pit_progressive(brackets, taxable_income)


async def _calculate_pit(db: AsyncSession, taxable_income: Decimal) -> Decimal:
    pit, _ = await _calculate_pit_and_bracket(db, taxable_income)
    return pit


def _dec(v: float | Decimal | None) -> Decimal:
    if v is None:
        return Decimal("0")
    return Decimal(str(v))


async def _calculate_one(
    db: AsyncSession,
    emp: Employee,
    month: str,
    existing: PayrollMonthly | None,
    created_by: str,
) -> PayrollMonthly:
    month_d = _month_to_date(month)

    gs = await db.scalar(
        select(LkGradeStep).where(
            LkGradeStep.grade == emp.grade,
            LkGradeStep.step == emp.step,
        )
    )
    if gs is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "ERR_PAYROLL_BASIC_MISMATCH",
                "message": f"No grade/step entry for G{emp.grade}/S{emp.step}",
            },
        )

    basic = basic_salary_lak(gs.grade_step_index, Decimal(str(gs.salary_index_rate)))

    position_all = await _get_allowance_rate(db, emp.position_level, basic)
    yos_all = await _calc_years_service_allowance(db, emp.date_of_joining, month_d)
    remote_all = (
        await _get_allowance_rate(
            db,
            "Remote / Difficult Area Allowance Rate — % of Basic Salary",
            basic,
        )
        if emp.is_remote_area
        else Decimal("0")
    )
    hazardous_all = (
        await _get_allowance_rate(db, "Hardship and Hazardous Jobs Allowance", basic)
        if emp.is_hazardous_area
        else Decimal("0")
    )
    foreign_all = (
        await _get_allowance_rate(
            db,
            "Foreign Representative Living Allowance (LAK equivalent)",
            basic,
        )
        if emp.is_foreign_posting
        else Decimal("0")
    )
    spouse_all = (
        await _get_allowance_rate(db, "Spouse Benefit", basic) if emp.has_spouse else Decimal("0")
    )
    child_unit = await _get_allowance_rate(db, "Child Benefit (per child, max 3)", basic)
    children_all = _lak(child_unit * Decimal(emp.eligible_children))
    teaching_all = (
        await _get_allowance_rate(
            db,
            "Teaching Allowance Rate — % of Basic Salary",
            basic,
        )
        if emp.field_allowance_type == "Teaching"
        else Decimal("0")
    )
    medical_all = (
        await _get_allowance_rate(db, "Medical Personnel Allowance", basic)
        if emp.field_allowance_type == "Medical"
        else Decimal("0")
    )
    na_all = (
        await _get_allowance_rate(db, "National Assembly (NA) Member Allowance", basic)
        if emp.is_na_member
        else Decimal("0")
    )

    if existing is not None:
        free_a1 = _dec(existing.other_allowance_1_lak)
        free_a2 = _dec(existing.other_allowance_2_lak)
        free_a3 = _dec(existing.other_allowance_3_lak)
        free_d1 = _dec(existing.addl_deduction_1_lak)
        free_d2 = _dec(existing.addl_deduction_2_lak)
    else:
        free_a1 = free_a2 = free_a3 = free_d1 = free_d2 = Decimal("0")

    std_sum = (
        position_all
        + yos_all
        + remote_all
        + hazardous_all
        + foreign_all
        + spouse_all
        + children_all
        + teaching_all
        + medical_all
        + na_all
    )
    gross = gross_earnings_lak(basic, std_sum, free_a1, free_a2, free_a3)

    employee_sso = employee_sso_lak(basic)
    employer_sso = employer_sso_lak(basic)
    taxable = taxable_income_lak(gross, employee_sso)
    pit, bracket_no = await _calculate_pit_and_bracket(db, taxable)

    net = net_salary_lak(gross, employee_sso, pit, free_d1, free_d2)
    if net < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "ERR_PAYROLL_NEGATIVE_NET",
                "message": f"Net salary negative for {emp.employee_code}",
            },
        )

    total_allow = total_allowances_lak(std_sum, free_a1, free_a2, free_a3)
    total_ded = total_deductions_lak(employee_sso, pit, free_d1, free_d2)

    now = datetime.now(timezone.utc)

    if existing is not None:
        row = existing
    else:
        row = PayrollMonthly(employee_code=emp.employee_code, payroll_month=month_d)

    row.grade = emp.grade
    row.step = emp.step
    row.grade_step_key = gs.grade_step_key
    row.grade_step_index = gs.grade_step_index
    row.salary_index_rate = float(gs.salary_index_rate)
    row.basic_salary_lak = float(basic)
    row.position_allowance_lak = float(position_all)
    row.years_service_allowance_lak = float(yos_all)
    row.teaching_allowance_lak = float(teaching_all)
    row.medical_allowance_lak = float(medical_all)
    row.na_member_allowance_lak = float(na_all)
    row.hazardous_allowance_lak = float(hazardous_all)
    row.remote_allowance_lak = float(remote_all)
    row.foreign_living_allow_lak = float(foreign_all)
    row.fuel_benefit_lak = float(Decimal("0"))
    row.spouse_benefit_lak = float(spouse_all)
    row.child_benefit_lak = float(children_all)
    row.other_allowance_1_lak = float(free_a1)
    row.other_allowance_2_lak = float(free_a2)
    row.other_allowance_3_lak = float(free_a3)
    row.total_allowances_lak = float(total_allow)
    row.gross_earnings_lak = float(gross)
    row.sso_rate_ref = "SSO Employee Contribution Rate (%)"
    row.sso_employee_contribution = float(employee_sso)
    row.taxable_income_lak = float(taxable)
    row.applicable_bracket_no = bracket_no
    row.pit_amount_lak = float(pit)
    row.addl_deduction_1_lak = float(free_d1)
    row.addl_deduction_2_lak = float(free_d2)
    row.total_deductions_lak = float(total_ded)
    row.net_salary_lak = float(net)
    row.calculated_at = now
    row.calculated_by = created_by

    if existing is None:
        row.approval_status = "PENDING"
        row.approved_by = None
        row.approved_at = None
        row.is_locked = False
        row.locked_by = None
        row.locked_at = None

    return row


async def payroll_row_to_out(
    _db: AsyncSession,
    row: PayrollMonthly,
    emp: Employee,
) -> PayrollMonthlyOut:
    basic = _dec(row.basic_salary_lak)
    housing_d = Decimal("0")
    transport_d = Decimal("0")

    status = row.approval_status
    locked_at = row.locked_at if row.is_locked else None

    full_name = f"{emp.title} {emp.first_name} {emp.last_name}".strip()
    gross = _dec(row.gross_earnings_lak)
    emp_sso = _dec(row.sso_employee_contribution)
    employer_sso = employer_sso_lak(basic)

    data = {
        "employee_code": row.employee_code,
        "payroll_month": row.payroll_month.isoformat()[:7],
        "grade": row.grade,
        "step": row.step,
        "basic_salary": _dec(row.basic_salary_lak),
        "allowance_position": _dec(row.position_allowance_lak),
        "allowance_technical": _dec(row.years_service_allowance_lak),
        "allowance_remote": _dec(row.remote_allowance_lak),
        "allowance_hazardous": _dec(row.hazardous_allowance_lak),
        "allowance_foreign": _dec(row.foreign_living_allow_lak),
        "allowance_spouse": _dec(row.spouse_benefit_lak),
        "allowance_children": _dec(row.child_benefit_lak),
        "allowance_teaching": _dec(row.teaching_allowance_lak),
        "allowance_medical": _dec(row.medical_allowance_lak),
        "allowance_na": _dec(row.na_member_allowance_lak),
        "allowance_housing": housing_d,
        "allowance_transport": transport_d,
        "free_allowance_1": _dec(row.other_allowance_1_lak),
        "free_allowance_2": _dec(row.other_allowance_2_lak),
        "free_allowance_3": _dec(row.other_allowance_3_lak),
        "free_allowance_1_desc": row.other_allowance_1_desc,
        "free_allowance_2_desc": row.other_allowance_2_desc,
        "free_allowance_3_desc": row.other_allowance_3_desc,
        "free_deduction_1_desc": row.addl_deduction_1_desc,
        "free_deduction_2_desc": row.addl_deduction_2_desc,
        "gross_salary": gross,
        "employee_sso": emp_sso,
        "employer_sso": employer_sso,
        "taxable_income": _dec(row.taxable_income_lak),
        "pit_amount": _dec(row.pit_amount_lak),
        "free_deduction_1": _dec(row.addl_deduction_1_lak),
        "free_deduction_2": _dec(row.addl_deduction_2_lak),
        "net_salary": _dec(row.net_salary_lak),
        "status": status,
        "approved_by": row.approved_by,
        "approved_at": row.approved_at,
        "locked_at": locked_at,
        "created_by": row.calculated_by,
        "created_at": row.calculated_at,
        "updated_at": row.calculated_at,
        "full_name": full_name,
        "ministry_name": emp.ministry_name,
    }
    return PayrollMonthlyOut.model_validate(data)


async def validate_payroll_run_prerequisites(
    db: AsyncSession,
    request: PayrollRunRequest,
    current_user: User,
) -> None:
    """Same validation as the start of `run_payroll_month` (before employee iteration)."""
    if not _MONTH_RE.match(request.month):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ERR_VALIDATION", "message": "Invalid month"},
        )
    y, mon = map(int, request.month.split("-"))
    today = date.today()
    if (y, mon) > (today.year, today.month):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_PAYROLL_FUTURE_MONTH", "message": "Cannot run payroll for a future month."},
        )

    month_d = _month_to_date(request.month)

    locked_q = (
        select(func.count())
        .select_from(PayrollMonthly)
        .join(Employee, Employee.employee_code == PayrollMonthly.employee_code)
        .where(
            PayrollMonthly.payroll_month == month_d,
            PayrollMonthly.approval_status == "LOCKED",
        )
    )
    if request.ministry_filter:
        locked_q = locked_q.where(Employee.ministry_name == request.ministry_filter)
    locked_count = await db.scalar(locked_q)
    if locked_count and locked_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_PAYROLL_MONTH_LOCKED", "message": "This payroll month is locked."},
        )


async def run_payroll_month(
    db: AsyncSession,
    request: PayrollRunRequest,
    current_user: User,
) -> dict:
    await validate_payroll_run_prerequisites(db, request, current_user)

    await set_audit_change_remarks(db, f"payroll_run:{request.month}")

    month_d = _month_to_date(request.month)

    stmt = select(Employee).where(Employee.is_active.is_(True))
    scope_part = await employee_scope_clause(db, current_user)
    if scope_part is not None:
        stmt = stmt.where(scope_part)
    if current_user.role == "ROLE_ADMIN" and request.ministry_filter:
        stmt = stmt.where(Employee.ministry_name == request.ministry_filter)
    res = await db.execute(stmt)
    employees = list(res.scalars().all())

    processed = 0
    for emp in employees:
        existing = await db.scalar(
            select(PayrollMonthly).where(
                PayrollMonthly.employee_code == emp.employee_code,
                PayrollMonthly.payroll_month == month_d,
            )
        )
        if existing is not None and existing.approval_status == "LOCKED":
            continue
        calculated = await _calculate_one(
            db,
            emp,
            request.month,
            existing,
            current_user.full_name,
        )
        if existing is None:
            db.add(calculated)
        processed += 1

    await db.commit()
    await invalidate_dashboard_cache()
    return {
        "month": request.month,
        "processed": processed,
        "ministry_filter": request.ministry_filter,
    }


async def list_payroll(
    db: AsyncSession,
    current_user: User,
    month: str | None,
    ministry: str | None,
    page: int = 1,
    limit: int = 50,
    status_filter: str | None = None,
) -> dict:
    cq = (
        select(func.count())
        .select_from(PayrollMonthly)
        .join(Employee, Employee.employee_code == PayrollMonthly.employee_code)
    )
    scope_part = await employee_scope_clause(db, current_user)
    if scope_part is not None:
        cq = cq.where(scope_part)
    if month:
        cq = cq.where(PayrollMonthly.payroll_month == _month_to_date(month))
    if ministry and current_user.role == "ROLE_ADMIN":
        cq = cq.where(Employee.ministry_name == ministry)
    if status_filter and status_filter.upper() in ("PENDING", "APPROVED", "LOCKED"):
        cq = cq.where(PayrollMonthly.approval_status == status_filter.upper())
    total = await db.scalar(cq) or 0

    offset = (page - 1) * limit
    q = (
        select(PayrollMonthly, Employee)
        .join(Employee, Employee.employee_code == PayrollMonthly.employee_code)
    )
    if scope_part is not None:
        q = q.where(scope_part)
    if month:
        q = q.where(PayrollMonthly.payroll_month == _month_to_date(month))
    if ministry and current_user.role == "ROLE_ADMIN":
        q = q.where(Employee.ministry_name == ministry)
    if status_filter and status_filter.upper() in ("PENDING", "APPROVED", "LOCKED"):
        q = q.where(PayrollMonthly.approval_status == status_filter.upper())

    q = q.order_by(Employee.employee_code.asc()).offset(offset).limit(limit)
    res = await db.execute(q)
    rows = res.all()

    items: list[dict] = []
    for pm, emp in rows:
        out = await payroll_row_to_out(db, pm, emp)
        items.append(out.model_dump(mode="json"))

    pages = max(1, int(math.ceil(total / limit))) if limit else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    }


async def patch_free_fields(
    db: AsyncSession,
    employee_code: str,
    month: str,
    body: PayrollFreeFieldPatch,
    current_user: User,
) -> PayrollMonthly:
    month_d = _month_to_date(month)
    row = await db.scalar(
        select(PayrollMonthly).where(
            PayrollMonthly.employee_code == employee_code,
            PayrollMonthly.payroll_month == month_d,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_EMP_NOT_FOUND", "message": "Payroll row not found"},
        )
    if row.approval_status == "LOCKED" or row.is_locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_PAYROLL_MONTH_LOCKED", "message": "This payroll month is locked."},
        )

    patch = body.model_dump(exclude_unset=True)
    if "free_allowance_1" in patch and patch["free_allowance_1"] is not None:
        row.other_allowance_1_lak = float(patch["free_allowance_1"])
    if "free_allowance_2" in patch and patch["free_allowance_2"] is not None:
        row.other_allowance_2_lak = float(patch["free_allowance_2"])
    if "free_allowance_3" in patch and patch["free_allowance_3"] is not None:
        row.other_allowance_3_lak = float(patch["free_allowance_3"])
    if "free_deduction_1" in patch and patch["free_deduction_1"] is not None:
        row.addl_deduction_1_lak = float(patch["free_deduction_1"])
    if "free_deduction_2" in patch and patch["free_deduction_2"] is not None:
        row.addl_deduction_2_lak = float(patch["free_deduction_2"])
    if "other_allowance_1_desc" in patch and patch["other_allowance_1_desc"] is not None:
        row.other_allowance_1_desc = patch["other_allowance_1_desc"]
    if "other_allowance_2_desc" in patch and patch["other_allowance_2_desc"] is not None:
        row.other_allowance_2_desc = patch["other_allowance_2_desc"]
    if "other_allowance_3_desc" in patch and patch["other_allowance_3_desc"] is not None:
        row.other_allowance_3_desc = patch["other_allowance_3_desc"]
    if "addl_deduction_1_desc" in patch and patch["addl_deduction_1_desc"] is not None:
        row.addl_deduction_1_desc = patch["addl_deduction_1_desc"]
    if "addl_deduction_2_desc" in patch and patch["addl_deduction_2_desc"] is not None:
        row.addl_deduction_2_desc = patch["addl_deduction_2_desc"]

    emp = await db.scalar(select(Employee).where(Employee.employee_code == employee_code))
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_EMP_NOT_FOUND", "message": "Employee not found"},
        )
    await assert_employee_accessible(db, emp, current_user)

    await set_audit_change_remarks(db, f"payroll_patch_free:{month}:{employee_code}")

    await _calculate_one(db, emp, month, row, current_user.full_name)
    await db.commit()
    await db.refresh(row)
    return row


async def approve_payroll(
    db: AsyncSession,
    request: PayrollApproveRequest,
    current_user: User,
) -> dict:
    await set_audit_change_remarks(db, f"payroll_approve:{request.month}")

    month_d = _month_to_date(request.month)

    exists_q = select(func.count()).select_from(PayrollMonthly).where(PayrollMonthly.payroll_month == month_d)
    exists = await db.scalar(exists_q)
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_PAYROLL_NOT_FOUND", "message": "No payroll found for this month"},
        )

    now = datetime.now(timezone.utc)
    stmt = (
        select(PayrollMonthly)
        .join(Employee, Employee.employee_code == PayrollMonthly.employee_code)
        .where(
            PayrollMonthly.payroll_month == month_d,
            PayrollMonthly.approval_status == "PENDING",
        )
    )
    if current_user.role == "ROLE_MANAGER":
        mscope = await get_manager_scope(db, current_user.user_id)
        if not mscope:
            return {"month": request.month, "approved_rows": 0}
        stmt = stmt.where(
            or_(
                *[
                    and_(
                        Employee.service_province == s["location"],
                        Employee.department_name == s["department_name"],
                    )
                    for s in mscope
                ],
            ),
        )
    elif request.ministry:
        stmt = stmt.where(Employee.ministry_name == request.ministry)
    if request.employee_code:
        stmt = stmt.where(PayrollMonthly.employee_code == request.employee_code)

    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    if not rows:
        return {"month": request.month, "approved_rows": 0}

    for row in rows:
        row.approval_status = "APPROVED"
        row.approved_by = current_user.full_name
        row.approved_at = now
        row.is_locked = False

    await db.commit()
    return {"month": request.month, "approved_rows": len(rows)}


async def lock_payroll(
    db: AsyncSession,
    request: PayrollLockRequest,
    current_user: User,
) -> dict:
    await set_audit_change_remarks(db, f"payroll_lock:{request.month}")

    month_d = _month_to_date(request.month)

    pending_q = select(func.count()).select_from(PayrollMonthly).where(
        PayrollMonthly.payroll_month == month_d,
        PayrollMonthly.approval_status == "PENDING",
    )
    pending_count = await db.scalar(pending_q) or 0
    if pending_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "ERR_PAYROLL_NOT_APPROVED",
                "message": "All rows must be approved before locking",
            },
        )

    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(PayrollMonthly).where(
            PayrollMonthly.payroll_month == month_d,
            PayrollMonthly.approval_status == "APPROVED",
        )
    )
    rows = list(res.scalars().all())
    for row in rows:
        row.approval_status = "LOCKED"
        row.is_locked = True
        row.locked_at = now
        row.locked_by = current_user.full_name

    await db.commit()
    return {"month": request.month, "locked_rows": len(rows)}


async def unlock_payroll(
    db: AsyncSession,
    request: PayrollUnlockRequest,
    current_user: User,
) -> dict:
    await set_audit_change_remarks(db, f"payroll_unlock:{request.month}")

    month_d = _month_to_date(request.month)

    res = await db.execute(
        select(PayrollMonthly).where(
            PayrollMonthly.payroll_month == month_d,
            PayrollMonthly.approval_status == "LOCKED",
        )
    )
    rows = list(res.scalars().all())
    for row in rows:
        row.approval_status = "APPROVED"
        row.is_locked = False
        row.locked_at = None
        row.locked_by = None

    await db.commit()
    return {"month": request.month, "unlocked_rows": len(rows), "reason": request.reason}
