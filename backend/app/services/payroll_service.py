"""Payroll calculation engine — monthly run, list, patch, approve, lock, unlock."""

from __future__ import annotations

import math
import re
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Employee, LkAllowanceRates, LkGradeStep, LkPitBrackets, PayrollMonthly
from app.schemas.auth import User
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
_PIT_OPEN_END = Decimal("999999999999999")


def _lak(v: Decimal) -> Decimal:
    return v.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _month_to_date(month: str) -> date:
    if not _MONTH_RE.match(month):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ERR_VALIDATION", "message": "Invalid month format"},
        )
    y, m = map(int, month.split("-"))
    return date(y, m, 1)


def _allowance_rate_type(eligibility: str | None) -> str:
    if eligibility and eligibility.strip().upper().startswith("TYPE:PCT"):
        return "PCT"
    return "FLAT"


async def _get_allowance_rate(
    db: AsyncSession,
    allowance_name: str,
    basic_salary: Decimal,
) -> Decimal:
    row = await db.scalar(select(LkAllowanceRates).where(LkAllowanceRates.allowance_name == allowance_name))
    if row is None:
        return Decimal("0")
    rt = _allowance_rate_type(row.eligibility)
    amt = Decimal(str(row.amount_or_rate))
    if rt == "PCT":
        return _lak(basic_salary * (amt / Decimal("100")))
    return _lak(amt)


async def _calculate_pit_and_bracket(
    db: AsyncSession,
    taxable_income: Decimal,
) -> tuple[Decimal, int]:
    res = await db.execute(select(LkPitBrackets).order_by(LkPitBrackets.bracket_no.asc()))
    brackets = list(res.scalars().all())
    if not brackets:
        return Decimal("0"), 1

    pit = Decimal("0")
    remaining = taxable_income
    last_used_bracket_no = brackets[0].bracket_no

    for bracket in brackets:
        if remaining <= 0:
            break
        lower = Decimal(str(bracket.income_from_lak))
        upper = Decimal(str(bracket.income_to_lak))
        if upper >= _PIT_OPEN_END:
            taxable_in_bracket = remaining
        else:
            width = upper - lower
            taxable_in_bracket = min(remaining, width)
        rate = Decimal(str(bracket.rate_pct)) / Decimal("100")
        pit += taxable_in_bracket * rate
        remaining -= taxable_in_bracket
        if taxable_in_bracket > 0:
            last_used_bracket_no = bracket.bracket_no

    return _lak(pit), int(last_used_bracket_no)


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

    basic = _lak(Decimal(gs.grade_step_index) * Decimal(str(gs.salary_index_rate)))

    position_all = await _get_allowance_rate(db, emp.position_level, basic)
    technical_all = await _get_allowance_rate(db, emp.profession_category, basic)
    remote_all = (
        await _get_allowance_rate(db, "Remote Area", basic) if emp.is_remote_area else Decimal("0")
    )
    hazardous_all = (
        await _get_allowance_rate(db, "Hazardous Area", basic) if emp.is_hazardous_area else Decimal("0")
    )
    foreign_all = (
        await _get_allowance_rate(db, "Foreign Posting", basic) if emp.is_foreign_posting else Decimal("0")
    )
    spouse_all = await _get_allowance_rate(db, "Spouse Allowance", basic) if emp.has_spouse else Decimal("0")
    child_unit = await _get_allowance_rate(db, "Child Allowance", basic)
    children_all = _lak(child_unit * Decimal(emp.eligible_children))
    teaching_all = (
        await _get_allowance_rate(db, "Teaching Allowance", basic)
        if emp.field_allowance_type == "Teaching"
        else Decimal("0")
    )
    medical_all = (
        await _get_allowance_rate(db, "Medical Allowance", basic)
        if emp.field_allowance_type == "Medical"
        else Decimal("0")
    )
    na_all = await _get_allowance_rate(db, "NA Member Allowance", basic) if emp.is_na_member else Decimal("0")
    housing_all = await _get_allowance_rate(db, "Housing Allowance", basic)
    transport_all = await _get_allowance_rate(db, "Transport Allowance", basic)

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
        + technical_all
        + remote_all
        + hazardous_all
        + foreign_all
        + spouse_all
        + children_all
        + teaching_all
        + medical_all
        + na_all
        + housing_all
        + transport_all
    )
    gross = _lak(basic + std_sum + free_a1 + free_a2 + free_a3)

    employee_sso = _lak(basic * Decimal("0.055"))
    employer_sso = _lak(basic * Decimal("0.06"))
    taxable = _lak(gross - employee_sso)
    pit, bracket_no = await _calculate_pit_and_bracket(db, taxable)

    net = _lak(gross - employee_sso - pit - free_d1 - free_d2)
    if net < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "ERR_PAYROLL_NEGATIVE_NET",
                "message": f"Net salary negative for {emp.employee_code}",
            },
        )

    total_allow = (
        position_all
        + technical_all
        + remote_all
        + hazardous_all
        + foreign_all
        + spouse_all
        + children_all
        + teaching_all
        + medical_all
        + na_all
        + housing_all
        + transport_all
        + free_a1
        + free_a2
        + free_a3
    )
    total_allow = _lak(total_allow)
    total_ded = _lak(employee_sso + pit + free_d1 + free_d2)

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
    row.years_service_allowance_lak = float(technical_all)
    row.teaching_allowance_lak = float(teaching_all)
    row.medical_allowance_lak = float(medical_all)
    row.na_member_allowance_lak = float(na_all)
    row.hazardous_allowance_lak = float(hazardous_all)
    row.remote_allowance_lak = float(remote_all)
    row.foreign_living_allow_lak = float(foreign_all)
    row.fuel_benefit_lak = float(_lak(housing_all + transport_all))
    row.spouse_benefit_lak = float(spouse_all)
    row.child_benefit_lak = float(children_all)
    row.other_allowance_1_lak = float(free_a1)
    row.other_allowance_2_lak = float(free_a2)
    row.other_allowance_3_lak = float(free_a3)
    row.total_allowances_lak = float(total_allow)
    row.gross_earnings_lak = float(gross)
    row.sso_rate_ref = emp.position_level
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


def _housing_transport_from_fuel(
    fuel_stored: Decimal,
    housing_recalc: Decimal,
    transport_recalc: Decimal,
) -> tuple[Decimal, Decimal]:
    """Split stored fuel (housing+transport) for display when recalc sum matches."""
    combined = _lak(housing_recalc + transport_recalc)
    if combined == Decimal("0"):
        return housing_recalc, transport_recalc
    if fuel_stored == combined:
        return housing_recalc, transport_recalc
    if fuel_stored <= Decimal("0"):
        return Decimal("0"), Decimal("0")
    ratio = fuel_stored / combined
    return _lak(housing_recalc * ratio), _lak(transport_recalc * ratio)


async def payroll_row_to_out(
    db: AsyncSession,
    row: PayrollMonthly,
    emp: Employee,
) -> PayrollMonthlyOut:
    basic = _dec(row.basic_salary_lak)
    housing_r = await _get_allowance_rate(db, "Housing Allowance", basic)
    transport_r = await _get_allowance_rate(db, "Transport Allowance", basic)
    fuel_stored = _dec(row.fuel_benefit_lak)
    housing_d, transport_d = _housing_transport_from_fuel(fuel_stored, housing_r, transport_r)

    status = row.approval_status
    locked_at = row.locked_at if row.is_locked else None

    full_name = f"{emp.title} {emp.first_name} {emp.last_name}".strip()
    gross = _dec(row.gross_earnings_lak)
    emp_sso = _dec(row.sso_employee_contribution)
    employer_sso = _lak(basic * Decimal("0.06"))

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


async def run_payroll_month(
    db: AsyncSession,
    request: PayrollRunRequest,
    current_user: User,
) -> dict:
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
        if existing is not None and existing.approval_status in ("APPROVED", "LOCKED"):
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

    emp = await db.scalar(select(Employee).where(Employee.employee_code == employee_code))
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_EMP_NOT_FOUND", "message": "Employee not found"},
        )
    await assert_employee_accessible(db, emp, current_user)

    await _calculate_one(db, emp, month, row, current_user.full_name)
    await db.commit()
    await db.refresh(row)
    return row


async def approve_payroll(
    db: AsyncSession,
    request: PayrollApproveRequest,
    current_user: User,
) -> dict:
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
