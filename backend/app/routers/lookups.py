from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import AuthUser
from app.models.lk_bank_master import LkBankMaster
from app.models.lk_location_master import LkLocationMaster
from app.models.lk_org_master import LkOrgMaster

router = APIRouter(prefix="/lookups", tags=["lookups"])

STUB = {"success": False, "data": None, "pagination": None, "error": None}


def _ok(data: object) -> dict:
    return {"success": True, "data": data, "pagination": None, "error": None}


@router.get("/ministries")
async def list_ministries(
    _user: AuthUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Distinct ministry names from org master (same source as department lookup)."""
    result = await db.execute(
        select(LkOrgMaster.ministry_name).distinct().order_by(LkOrgMaster.ministry_name.asc()),
    )
    rows = [r[0] for r in result.all()]
    return _ok(rows)


@router.get("/departments")
async def list_departments(
    db: AsyncSession = Depends(get_db),
    location: str | None = Query(None, description="Service province; filters when org data is location-aware"),
) -> dict:
    """Public: departments from org master (distinct). Location reserved for future filtering."""
    _ = location
    result = await db.execute(
        select(LkOrgMaster.department_name).distinct().order_by(LkOrgMaster.department_name.asc()),
    )
    rows = [r[0] for r in result.all()]
    return _ok(rows)


@router.get("/divisions")
async def list_divisions(_user: AuthUser, dept_key: str | None = Query(None)) -> dict:
    """TODO: GET /lookups/divisions"""
    return STUB


@router.get("/org-derived")
async def org_derived(_user: AuthUser, ministry_name: str | None = Query(None)) -> dict:
    """TODO: GET /lookups/org-derived"""
    return STUB


@router.get("/countries")
async def list_countries(_user: AuthUser) -> dict:
    """TODO: GET /lookups/countries"""
    return STUB


@router.get("/provinces")
async def list_provinces(
    db: AsyncSession = Depends(get_db),
    country_key: str | None = Query(None),
) -> dict:
    """Public: provinces from location master."""
    _ = country_key
    result = await db.execute(select(LkLocationMaster.province).order_by(LkLocationMaster.province.asc()))
    rows = [r[0] for r in result.all()]
    return _ok(rows)


@router.get("/districts")
async def list_districts(_user: AuthUser, province_key: str | None = Query(None)) -> dict:
    """TODO: GET /lookups/districts"""
    return STUB


@router.get("/location-derived")
async def location_derived(_user: AuthUser, province: str | None = Query(None)) -> dict:
    """TODO: GET /lookups/location-derived"""
    return STUB


@router.get("/banks")
async def list_banks(
    _user: AuthUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Distinct bank names from bank master (for dropdowns / FK employee.bank_name)."""
    result = await db.execute(
        select(LkBankMaster.bank_name).distinct().order_by(LkBankMaster.bank_name.asc()),
    )
    rows = [r[0] for r in result.all()]
    return _ok(rows)


@router.get("/branches")
async def list_branches(
    _user: AuthUser,
    db: AsyncSession = Depends(get_db),
    bank_key: str | None = Query(
        None,
        description="When set, branch names for that bank (match bank_name or bank_key). Omit for all branch names.",
    ),
) -> dict:
    """With bank_key: distinct branch_name strings for that bank. Without: all (bank_name, branch_name) pairs."""
    if bank_key:
        result = await db.execute(
            select(LkBankMaster.branch_name)
            .where(or_(LkBankMaster.bank_name == bank_key, LkBankMaster.bank_key == bank_key))
            .distinct()
            .order_by(LkBankMaster.branch_name.asc()),
        )
        rows = [r[0] for r in result.all()]
    else:
        result = await db.execute(
            select(LkBankMaster.bank_name, LkBankMaster.branch_name)
            .distinct()
            .order_by(LkBankMaster.bank_name.asc(), LkBankMaster.branch_name.asc()),
        )
        rows = [{"bank_name": r[0], "branch_name": r[1]} for r in result.all()]
    return _ok(rows)


@router.get("/bank-derived")
async def bank_derived(
    _user: AuthUser,
    bank_name: str | None = Query(None),
    branch_name: str | None = Query(None),
) -> dict:
    """TODO: GET /lookups/bank-derived"""
    return STUB


@router.get("/grade-derive")
async def grade_derive(
    _user: AuthUser,
    education_level: str | None = Query(None),
    prior_experience_years: int | None = Query(None),
) -> dict:
    """TODO: GET /lookups/grade-derive"""
    return STUB
