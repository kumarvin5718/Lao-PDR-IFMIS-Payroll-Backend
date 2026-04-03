"""Master lookup table read/update services (LK tables)."""

from __future__ import annotations

import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Employee,
    LkAllowanceRates,
    LkBankMaster,
    LkGradeDerivation,
    LkGradeStep,
    LkLocationMaster,
    LkOrgMaster,
    LkPitBrackets,
)
from app.schemas.master import (
    AllowanceRateCreate,
    AllowanceRateUpdate,
    BankCreate,
    BankUpdate,
    GradeDerivationCreate,
    GradeDerivationUpdate,
    GradeStepUpdate,
    LocationCreate,
    LocationUpdate,
    OrgCreate,
    OrgUpdate,
    PITBracketUpdate,
)

# Open-ended PIT bracket upper bound (no practical cap)
_PIT_UPPER_OPEN_END = Decimal("999999999999999")

_DEFAULT_BANK_BRANCH = "Main"


def _allowance_rate_type(eligibility: str | None) -> str:
    if eligibility and eligibility.strip().upper().startswith("TYPE:PCT"):
        return "PCT"
    return "FLAT"


def _set_allowance_rate_type(eligibility: str | None, rate_type: str) -> str:
    base = "TYPE:PCT" if rate_type.upper() == "PCT" else "TYPE:FLAT"
    if eligibility and not eligibility.strip().upper().startswith("TYPE:"):
        return f"{base}|{eligibility}"
    return base


def _org_is_active(row: LkOrgMaster) -> bool:
    return row.effective_to is None


def _bank_is_active(row: LkBankMaster) -> bool:
    return row.effective_to is None


def _location_is_active(row: LkLocationMaster) -> bool:
    return row.effective_to is None


def _pit_upper_display(income_to_lak: float | Decimal) -> float | None:
    val = float(income_to_lak)
    if val >= float(_PIT_UPPER_OPEN_END) * 0.999:
        return None
    return val


def _slug_key(text: str, max_len: int) -> str:
    s = re.sub(r"[^A-Za-z0-9]", "", text).upper()
    return (s[:max_len] if s else "X")[:max_len]


async def compute_master_employee_counts(db: AsyncSession) -> dict:
    """Active employees grouped by department, province, and (province + department) for manager scope."""
    by_department: dict[str, int] = {}
    q_dept = await db.execute(
        select(Employee.department_name, func.count())
        .where(Employee.is_active.is_(True))
        .group_by(Employee.department_name),
    )
    for name, cnt in q_dept.all():
        by_department[str(name)] = int(cnt)

    by_province: dict[str, int] = {}
    q_prov = await db.execute(
        select(Employee.service_province, func.count())
        .where(Employee.is_active.is_(True))
        .group_by(Employee.service_province),
    )
    for prov, cnt in q_prov.all():
        by_province[str(prov)] = int(cnt)

    by_manager_scope: dict[str, int] = {}
    q_scope = await db.execute(
        select(Employee.service_province, Employee.department_name, func.count())
        .where(Employee.is_active.is_(True))
        .group_by(Employee.service_province, Employee.department_name),
    )
    for prov, dept, cnt in q_scope.all():
        key = f"{prov}||{dept}"
        by_manager_scope[key] = int(cnt)

    return {
        "by_department": by_department,
        "by_province": by_province,
        "by_manager_scope": by_manager_scope,
    }


async def get_all_grade_steps(db: AsyncSession) -> list[LkGradeStep]:
    result = await db.execute(select(LkGradeStep).order_by(LkGradeStep.grade.asc(), LkGradeStep.step.asc()))
    return list(result.scalars().all())


async def update_grade_step(
    db: AsyncSession,
    grade: int,
    step: int,
    body: GradeStepUpdate,
) -> LkGradeStep:
    row = await db.scalar(select(LkGradeStep).where(LkGradeStep.grade == grade, LkGradeStep.step == step))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Grade/step combination not found"},
        )
    # UI basic_salary is monthly LAK; persist LAK per index point.
    rate = (Decimal(str(body.basic_salary)) / Decimal(row.grade_step_index)).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    if rate <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ERR_VALIDATION", "message": "basic_salary must yield a positive rate"},
        )
    row.salary_index_rate = float(rate)
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_allowance_rates(db: AsyncSession) -> list[LkAllowanceRates]:
    result = await db.execute(select(LkAllowanceRates).order_by(LkAllowanceRates.allowance_name.asc()))
    return list(result.scalars().all())


async def create_allowance_rate(db: AsyncSession, body: AllowanceRateCreate) -> LkAllowanceRates:
    dup = await db.scalar(
        select(func.count())
        .select_from(LkAllowanceRates)
        .where(LkAllowanceRates.allowance_name == body.allowance_name),
    )
    if dup and dup > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Allowance name already exists"},
        )
    row = LkAllowanceRates(
        allowance_name=body.allowance_name,
        amount_or_rate=body.rate_value,
        eligibility=_set_allowance_rate_type(None, body.rate_type),
        effective_from=body.effective_date or date.today(),
        effective_to=None,
        last_updated=date.today(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_allowance_rate(
    db: AsyncSession,
    name: str,
    body: AllowanceRateUpdate,
) -> LkAllowanceRates:
    row = await db.scalar(select(LkAllowanceRates).where(LkAllowanceRates.allowance_name == name))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Allowance not found"},
        )
    if body.rate_type is not None:
        if body.rate_type.upper() not in ("FLAT", "PCT"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "ERR_VALIDATION", "message": "rate_type must be FLAT or PCT"},
            )
        row.eligibility = _set_allowance_rate_type(row.eligibility, body.rate_type)
    if body.rate_value is not None:
        row.amount_or_rate = body.rate_value
    if body.effective_date is not None:
        row.effective_from = body.effective_date
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_grade_derivations(db: AsyncSession) -> list[LkGradeDerivation]:
    result = await db.execute(
        select(LkGradeDerivation).order_by(
            LkGradeDerivation.education_level.asc(),
            LkGradeDerivation.exp_min_years.asc(),
        )
    )
    return list(result.scalars().all())


async def derive_grade(
    db: AsyncSession,
    education_level: str,
    prior_experience_years: int,
    years_of_service: int,
) -> dict:
    total_exp = prior_experience_years + years_of_service
    stmt = (
        select(LkGradeDerivation)
        .where(
            LkGradeDerivation.education_level == education_level,
            LkGradeDerivation.exp_min_years <= total_exp,
        )
        .order_by(LkGradeDerivation.exp_min_years.desc())
        .limit(1)
    )
    row = await db.scalar(stmt)
    if row is None:
        return {"grade": 1, "step": 1, "derived": False}
    return {"grade": row.derived_grade, "step": row.derived_step, "derived": True}


async def create_grade_derivation(db: AsyncSession, body: GradeDerivationCreate) -> LkGradeDerivation:
    exp_max = body.exp_max_years if body.exp_max_years is not None else 99
    if exp_max < body.min_exp_years:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ERR_VALIDATION", "message": "exp_max_years must be >= min_exp_years"},
        )
    dup = await db.scalar(
        select(func.count())
        .select_from(LkGradeDerivation)
        .where(
            LkGradeDerivation.education_level == body.education_level,
            LkGradeDerivation.exp_min_years == body.min_exp_years,
        )
    )
    if dup and dup > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "This education + experience row already exists"},
        )
    row = LkGradeDerivation(
        education_level=body.education_level,
        exp_min_years=body.min_exp_years,
        exp_max_years=exp_max,
        derived_grade=body.derived_grade,
        derived_step=body.derived_step,
        last_updated=date.today(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_grade_derivation(
    db: AsyncSession,
    education_level: str,
    min_exp_years: int,
    body: GradeDerivationUpdate,
) -> LkGradeDerivation:
    row = await db.scalar(
        select(LkGradeDerivation).where(
            LkGradeDerivation.education_level == education_level,
            LkGradeDerivation.exp_min_years == min_exp_years,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Grade derivation row not found"},
        )
    row.derived_grade = body.derived_grade
    row.derived_step = body.derived_step
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_orgs(db: AsyncSession) -> list[LkOrgMaster]:
    result = await db.execute(
        select(LkOrgMaster).order_by(LkOrgMaster.ministry_name.asc(), LkOrgMaster.department_key.asc())
    )
    return list(result.scalars().all())


async def _allocate_ministry_key(db: AsyncSession, ministry_name: str) -> str:
    base = _slug_key(ministry_name, 10)
    key = base
    for i in range(100):
        n = await db.scalar(select(func.count()).select_from(LkOrgMaster).where(LkOrgMaster.ministry_key == key))
        if not n:
            return key
        suffix = str(i + 1)
        key = f"{base[: max(1, 10 - len(suffix))]}{suffix}"[:10]
    return base


async def create_org(db: AsyncSession, body: OrgCreate) -> LkOrgMaster:
    dup = await db.scalar(
        select(func.count())
        .select_from(LkOrgMaster)
        .where(LkOrgMaster.ministry_name == body.ministry_name, LkOrgMaster.department_key == body.dept_key)
    )
    if dup and dup > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Ministry/dept combination exists"},
        )
    ministry_key = await _allocate_ministry_key(db, body.ministry_name)
    row = LkOrgMaster(
        ministry_name=body.ministry_name,
        ministry_key=ministry_key,
        department_name=body.dept_display_name,
        department_key=body.dept_key,
        division_name=None,
        profession_category="General",
        na_allowance_eligible=False,
        field_allowance_type="None",
        effective_from=date.today(),
        effective_to=None if body.is_active else date.today(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_org(db: AsyncSession, ministry_name: str, dept_key: str, body: OrgUpdate) -> LkOrgMaster:
    row = await db.scalar(
        select(LkOrgMaster).where(
            LkOrgMaster.ministry_name == ministry_name,
            LkOrgMaster.department_key == dept_key,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Organisation row not found"},
        )
    if body.dept_display_name is not None:
        row.department_name = body.dept_display_name
    if body.is_active is not None:
        row.effective_to = None if body.is_active else date.today()
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_locations(db: AsyncSession) -> list[LkLocationMaster]:
    result = await db.execute(select(LkLocationMaster).order_by(LkLocationMaster.province.asc()))
    return list(result.scalars().all())


async def create_location(db: AsyncSession, body: LocationCreate) -> LkLocationMaster:
    dup = await db.scalar(
        select(func.count()).select_from(LkLocationMaster).where(LkLocationMaster.province == body.province)
    )
    if dup and dup > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Province already exists"},
        )
    province_key = _slug_key(body.province, 10)
    row = LkLocationMaster(
        province=body.province,
        country="Lao PDR",
        province_key=province_key,
        district=body.region,
        is_remote=body.is_remote_area,
        is_hazardous=body.is_hazardous_area,
        effective_from=date.today(),
        effective_to=None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_location(db: AsyncSession, province: str, body: LocationUpdate) -> LkLocationMaster:
    row = await db.scalar(select(LkLocationMaster).where(LkLocationMaster.province == province))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Province not found"},
        )
    if body.region is not None:
        row.district = body.region
    if body.is_remote_area is not None:
        row.is_remote = body.is_remote_area
    if body.is_hazardous_area is not None:
        row.is_hazardous = body.is_hazardous_area
    if body.is_active is not None:
        row.effective_to = None if body.is_active else date.today()
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_banks(db: AsyncSession) -> list[LkBankMaster]:
    result = await db.execute(
        select(LkBankMaster).order_by(LkBankMaster.bank_name.asc(), LkBankMaster.branch_name.asc())
    )
    return list(result.scalars().all())


async def create_bank(db: AsyncSession, body: BankCreate) -> LkBankMaster:
    dup = await db.scalar(
        select(func.count())
        .select_from(LkBankMaster)
        .where(LkBankMaster.bank_name == body.bank_name, LkBankMaster.branch_name == _DEFAULT_BANK_BRANCH)
    )
    if dup and dup > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Bank already exists"},
        )
    bank_key = body.bank_code[:6].ljust(6, "0")[:6]
    swift = (body.swift_code or "").strip() or "000000000000"
    row = LkBankMaster(
        bank_name=body.bank_name,
        bank_key=bank_key,
        branch_name=_DEFAULT_BANK_BRANCH,
        branch_code=body.bank_code,
        swift_code=swift[:12],
        effective_from=date.today(),
        effective_to=None if body.is_active else date.today(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_bank(db: AsyncSession, bank_name: str, bank_code: str, body: BankUpdate) -> LkBankMaster:
    row = await db.scalar(
        select(LkBankMaster).where(
            LkBankMaster.bank_name == bank_name,
            LkBankMaster.branch_code == bank_code,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Bank not found"},
        )
    if body.swift_code is not None:
        s = body.swift_code.strip()
        row.swift_code = s[:12] if s else "000000000000"
    if body.is_active is not None:
        row.effective_to = None if body.is_active else date.today()
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_pit_brackets(db: AsyncSession) -> list[LkPitBrackets]:
    result = await db.execute(select(LkPitBrackets).order_by(LkPitBrackets.bracket_no.asc()))
    return list(result.scalars().all())


async def update_pit_bracket(
    db: AsyncSession,
    bracket_no: int,
    body: PITBracketUpdate,
) -> LkPitBrackets:
    row = await db.scalar(select(LkPitBrackets).where(LkPitBrackets.bracket_no == bracket_no))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Bracket not found"},
        )
    patch = body.model_dump(exclude_unset=True)
    if "lower_bound" in patch:
        row.income_from_lak = patch["lower_bound"]
    if "upper_bound" in patch:
        if patch["upper_bound"] is None:
            row.income_to_lak = _PIT_UPPER_OPEN_END
        else:
            row.income_to_lak = patch["upper_bound"]
    if "rate_pct" in patch:
        row.rate_pct = patch["rate_pct"]
    if "deduction_amount" in patch:
        row.cumulative_tax_lak = patch["deduction_amount"]

    lower = float(row.income_from_lak)
    upper = float(row.income_to_lak)
    if upper <= lower:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ERR_VALIDATION", "message": "Upper bound must exceed lower bound"},
        )

    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row
