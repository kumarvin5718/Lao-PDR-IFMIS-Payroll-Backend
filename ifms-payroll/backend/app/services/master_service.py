"""Master lookup table read/update services (LK tables)."""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import String, and_, cast, func, or_, select
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
from app.schemas.allowance_rate import AllowanceRateCreate, AllowanceRateUpdate
from app.schemas.master import (
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


def _set_allowance_rate_type(eligibility: str | None, rate_type: str) -> str:
    base = "TYPE:PCT" if rate_type.upper() == "PCT" else "TYPE:FLAT"
    if eligibility and not eligibility.strip().upper().startswith("TYPE:"):
        return f"{base}|{eligibility}"
    return base


def _bank_is_active(row: LkBankMaster) -> bool:
    return row.effective_to is None


def _location_is_active(row: LkLocationMaster) -> bool:
    return row.effective_to is None or row.effective_to >= date.today()


def _pit_upper_display(income_to_lak: float | Decimal) -> float | None:
    val = float(income_to_lak)
    if val >= float(_PIT_UPPER_OPEN_END) * 0.999:
        return None
    return val


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


async def list_grade_steps_paginated(
    db: AsyncSession,
    *,
    search: str | None,
    page: int,
    size: int,
) -> dict:
    clause = None
    if search and search.strip():
        term = f"%{search.strip()}%"
        clause = or_(
            LkGradeStep.grade_step_key.ilike(term),
            LkGradeStep.min_education.ilike(term),
            LkGradeStep.notes.ilike(term),
            LkGradeStep.circular_ref.ilike(term),
            LkGradeStep.change_remarks.ilike(term),
            LkGradeStep.last_updated_by.ilike(term),
            cast(LkGradeStep.grade_step_index, String).ilike(term),
            cast(LkGradeStep.salary_index_rate, String).ilike(term),
            cast(LkGradeStep.grade, String).ilike(term),
            cast(LkGradeStep.step, String).ilike(term),
            cast(LkGradeStep.min_prior_experience_years, String).ilike(term),
        )
    count_stmt = select(func.count()).select_from(LkGradeStep)
    if clause is not None:
        count_stmt = count_stmt.where(clause)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = select(LkGradeStep).order_by(LkGradeStep.grade.asc(), LkGradeStep.step.asc())
    if clause is not None:
        stmt = stmt.where(clause)
    stmt = stmt.offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())
    pages = (total + size - 1) // size if size > 0 else 0
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


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


async def list_allowance_rates_paginated(
    db: AsyncSession,
    *,
    search: str | None,
    page: int,
    size: int,
) -> dict:
    clause = None
    if search and search.strip():
        term = f"%{search.strip()}%"
        clause = or_(
            LkAllowanceRates.allowance_name.ilike(term),
            LkAllowanceRates.eligibility.ilike(term),
            LkAllowanceRates.description.ilike(term),
        )
    count_stmt = select(func.count()).select_from(LkAllowanceRates)
    if clause is not None:
        count_stmt = count_stmt.where(clause)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = select(LkAllowanceRates).order_by(LkAllowanceRates.allowance_name.asc())
    if clause is not None:
        stmt = stmt.where(clause)
    stmt = stmt.offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())
    pages = (total + size - 1) // size if size > 0 else 0
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


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
        eligibility=_set_allowance_rate_type(body.eligibility, body.rate_type),
        description=body.description,
        effective_from=body.effective_from or body.effective_date or date.today(),
        effective_to=body.effective_to,
        circular_ref=body.circular_ref,
        change_remarks=body.change_remarks,
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
    if body.effective_from is not None:
        row.effective_from = body.effective_from
    elif body.effective_date is not None:
        row.effective_from = body.effective_date
    if body.effective_to is not None:
        row.effective_to = body.effective_to
    if body.circular_ref is not None:
        row.circular_ref = body.circular_ref
    if body.change_remarks is not None:
        row.change_remarks = body.change_remarks
    if body.description is not None:
        row.description = body.description
    if body.eligibility is not None and body.rate_type is None:
        row.eligibility = body.eligibility
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


async def list_grade_derivations_paginated(
    db: AsyncSession,
    *,
    search: str | None,
    page: int,
    size: int,
) -> dict:
    clause = None
    if search and search.strip():
        term = f"%{search.strip()}%"
        clause = or_(
            LkGradeDerivation.education_level.ilike(term),
            LkGradeDerivation.rule_description.ilike(term),
        )
    count_stmt = select(func.count()).select_from(LkGradeDerivation)
    if clause is not None:
        count_stmt = count_stmt.where(clause)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = select(LkGradeDerivation).order_by(
        LkGradeDerivation.education_level.asc(),
        LkGradeDerivation.exp_min_years.asc(),
    )
    if clause is not None:
        stmt = stmt.where(clause)
    stmt = stmt.offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())
    pages = (total + size - 1) // size if size > 0 else 0
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


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
    if body.rule_description is not None:
        row.rule_description = body.rule_description
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_orgs(db: AsyncSession) -> list[LkOrgMaster]:
    result = await db.execute(
        select(LkOrgMaster).order_by(LkOrgMaster.ministry_name.asc(), LkOrgMaster.department_key.asc())
    )
    return list(result.scalars().all())


async def create_org(db: AsyncSession, body: OrgCreate) -> LkOrgMaster:
    dup = await db.scalar(
        select(func.count())
        .select_from(LkOrgMaster)
        .where(LkOrgMaster.department_key == body.department_key),
    )
    if dup and dup > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Department key already exists"},
        )
    eff_from = body.effective_from or date.today()
    eff_to = body.effective_to
    row = LkOrgMaster(
        ministry_name=body.ministry_name,
        ministry_key=body.ministry_key,
        department_name=body.department_name,
        department_key=body.department_key,
        division_name=body.division_name,
        profession_category=body.profession_category,
        na_allowance_eligible=body.na_allowance_eligible,
        field_allowance_type=body.field_allowance_type,
        effective_from=eff_from,
        effective_to=eff_to,
        circular_ref=body.circular_ref,
        change_remarks=body.change_remarks,
        last_updated=date.today(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_org(db: AsyncSession, ministry_key: str, dept_key: str, body: OrgUpdate) -> LkOrgMaster:
    row = await db.scalar(
        select(LkOrgMaster).where(
            LkOrgMaster.ministry_key == ministry_key,
            LkOrgMaster.department_key == dept_key,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Organisation row not found"},
        )
    data = body.model_dump(exclude_unset=True)
    if "department_name" in data:
        row.department_name = data["department_name"]
    if "division_name" in data:
        row.division_name = data["division_name"]
    if "profession_category" in data:
        row.profession_category = data["profession_category"]
    if "na_allowance_eligible" in data:
        row.na_allowance_eligible = data["na_allowance_eligible"]
    if "field_allowance_type" in data:
        row.field_allowance_type = data["field_allowance_type"]
    if row.profession_category not in ("Teacher", "Medical"):
        row.field_allowance_type = None
    if "effective_from" in data:
        row.effective_from = data["effective_from"]
    if "circular_ref" in data:
        row.circular_ref = data["circular_ref"]
    if "change_remarks" in data:
        row.change_remarks = data["change_remarks"]
    if "effective_to" in data:
        row.effective_to = data["effective_to"]
    elif "is_active" in data:
        row.effective_to = None if data["is_active"] else date.today()
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_locations(db: AsyncSession) -> list[LkLocationMaster]:
    result = await db.execute(
        select(LkLocationMaster).order_by(
            LkLocationMaster.country_key.asc(),
            LkLocationMaster.province.asc(),
            LkLocationMaster.district_key.asc(),
        )
    )
    return list(result.scalars().all())


async def create_location(db: AsyncSession, body: LocationCreate) -> LkLocationMaster:
    dup = await db.scalar(
        select(func.count())
        .select_from(LkLocationMaster)
        .where(LkLocationMaster.district_key == body.district_key),
    )
    if dup and dup > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "District key already exists"},
        )
    row = LkLocationMaster(
        district_key=body.district_key,
        country=body.country,
        country_key=body.country_key,
        province_key=body.province_key,
        province=body.province,
        district=body.district,
        is_remote=body.is_remote_area,
        is_hazardous=body.is_hazardous_area,
        effective_from=date.today(),
        effective_to=None,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_location(db: AsyncSession, district_key: str, body: LocationUpdate) -> LkLocationMaster:
    row = await db.scalar(select(LkLocationMaster).where(LkLocationMaster.district_key == district_key))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_MASTER_KEY_IMMUTABLE", "message": "Location row not found"},
        )
    if body.district is not None:
        row.district = body.district
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


async def list_banks_paginated(
    db: AsyncSession,
    *,
    search: str | None,
    page: int,
    size: int,
    active_only: bool,
) -> dict:
    today = date.today()
    conds: list = []
    if active_only:
        conds.append(or_(LkBankMaster.effective_to.is_(None), LkBankMaster.effective_to >= today))
    if search and search.strip():
        term = f"%{search.strip()}%"
        conds.append(
            or_(
                LkBankMaster.bank_name.ilike(term),
                LkBankMaster.bank_key.ilike(term),
                LkBankMaster.branch_name.ilike(term),
                LkBankMaster.branch_code.ilike(term),
                LkBankMaster.swift_code.ilike(term),
                LkBankMaster.category.ilike(term),
                LkBankMaster.bank_abbrev.ilike(term),
                LkBankMaster.city.ilike(term),
                LkBankMaster.branch_address.ilike(term),
                LkBankMaster.bank_hq_address.ilike(term),
                LkBankMaster.telephone.ilike(term),
                LkBankMaster.ownership.ilike(term),
                LkBankMaster.established.ilike(term),
                LkBankMaster.website.ilike(term),
                LkBankMaster.circular_ref.ilike(term),
                LkBankMaster.change_remarks.ilike(term),
                LkBankMaster.last_updated_by.ilike(term),
            )
        )
    count_stmt = select(func.count()).select_from(LkBankMaster)
    if conds:
        count_stmt = count_stmt.where(and_(*conds))
    total = int(await db.scalar(count_stmt) or 0)

    stmt = select(LkBankMaster).order_by(LkBankMaster.bank_name.asc(), LkBankMaster.branch_name.asc())
    if conds:
        stmt = stmt.where(and_(*conds))
    stmt = stmt.offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())
    pages = (total + size - 1) // size if size > 0 else 0
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


async def create_bank(db: AsyncSession, body: BankCreate) -> LkBankMaster:
    branch_nm = ((body.branch_name or "").strip() or _DEFAULT_BANK_BRANCH)[:60]
    dup = await db.scalar(
        select(func.count())
        .select_from(LkBankMaster)
        .where(LkBankMaster.bank_name == body.bank_name, LkBankMaster.branch_name == branch_nm),
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
        branch_name=branch_nm,
        branch_code=body.bank_code,
        swift_code=swift[:12],
        category=body.category,
        bank_abbrev=body.bank_abbrev,
        city=body.city,
        branch_address=body.branch_address,
        bank_hq_address=body.bank_hq_address,
        telephone=body.telephone,
        ownership=body.ownership,
        established=body.established,
        website=body.website,
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
    patch = body.model_dump(exclude_unset=True)
    for key in (
        "category",
        "bank_abbrev",
        "city",
        "branch_address",
        "bank_hq_address",
        "telephone",
        "ownership",
        "established",
        "website",
        "circular_ref",
        "change_remarks",
    ):
        if key in patch:
            setattr(row, key, patch[key])
    row.last_updated = date.today()
    await db.commit()
    await db.refresh(row)
    return row


async def get_all_pit_brackets(db: AsyncSession) -> list[LkPitBrackets]:
    result = await db.execute(select(LkPitBrackets).order_by(LkPitBrackets.bracket_no.asc()))
    return list(result.scalars().all())


async def list_pit_brackets_paginated(
    db: AsyncSession,
    *,
    search: str | None,
    page: int,
    size: int,
) -> dict:
    clause = None
    if search and search.strip():
        term = f"%{search.strip()}%"
        clause = or_(
            cast(LkPitBrackets.bracket_no, String).ilike(term),
            cast(LkPitBrackets.income_from_lak, String).ilike(term),
            cast(LkPitBrackets.income_to_lak, String).ilike(term),
            cast(LkPitBrackets.rate_pct, String).ilike(term),
            cast(LkPitBrackets.cumulative_tax_lak, String).ilike(term),
            LkPitBrackets.description.ilike(term),
            LkPitBrackets.circular_ref.ilike(term),
            LkPitBrackets.change_remarks.ilike(term),
            LkPitBrackets.last_updated_by.ilike(term),
        )
    count_stmt = select(func.count()).select_from(LkPitBrackets)
    if clause is not None:
        count_stmt = count_stmt.where(clause)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = select(LkPitBrackets).order_by(LkPitBrackets.bracket_no.asc())
    if clause is not None:
        stmt = stmt.where(clause)
    stmt = stmt.offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())
    pages = (total + size - 1) // size if size > 0 else 0
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


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
