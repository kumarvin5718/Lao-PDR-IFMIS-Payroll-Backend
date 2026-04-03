from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import AuthUser, ROLE_MASTER_ACCESS
from app.models import (
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
    AllowanceRateOut,
    AllowanceRateUpdate,
    BankCreate,
    BankOut,
    BankUpdate,
    GradeDerivationCreate,
    GradeDerivationOut,
    GradeDerivationUpdate,
    GradeStepOut,
    GradeStepUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
    OrgCreate,
    OrgOut,
    OrgUpdate,
    PITBracketOut,
    PITBracketUpdate,
)
from app.services import master_service
from app.services.dashboard_service import cached_json
from app.services.master_service import (
    _allowance_rate_type,
    _bank_is_active,
    _location_is_active,
    _org_is_active,
    _pit_upper_display,
)

router = APIRouter(prefix="/master", tags=["master"])

_MASTER_EMPLOYEE_COUNTS_KEY = "master:employee-counts"


def _ok(data: dict | list) -> dict:
    return {"success": True, "data": data, "pagination": None, "error": None}


def _grade_step_out(row: LkGradeStep) -> dict:
    # Monthly basic = index points × LAK per point (matches payroll_service._calculate_one).
    basic = float(row.grade_step_index) * float(row.salary_index_rate)
    return GradeStepOut(
        grade=row.grade,
        step=row.step,
        basic_salary=basic,
    ).model_dump(mode="json")


def _allowance_out(row: LkAllowanceRates) -> dict:
    return AllowanceRateOut(
        allowance_name=row.allowance_name,
        rate_type=_allowance_rate_type(row.eligibility),
        rate_value=float(row.amount_or_rate),
        effective_date=row.effective_from,
    ).model_dump(mode="json")


def _grade_deriv_out(row: LkGradeDerivation) -> dict:
    return GradeDerivationOut(
        education_level=row.education_level,
        min_exp_years=row.exp_min_years,
        derived_grade=row.derived_grade,
        derived_step=row.derived_step,
    ).model_dump(mode="json")


def _org_out(row: LkOrgMaster) -> dict:
    return OrgOut(
        ministry_name=row.ministry_name,
        dept_key=row.department_key,
        dept_display_name=row.department_name,
        is_active=_org_is_active(row),
    ).model_dump(mode="json")


def _location_out(row: LkLocationMaster) -> dict:
    return LocationOut(
        province=row.province,
        region=row.district,
        is_remote_area=row.is_remote,
        is_hazardous_area=row.is_hazardous,
        is_active=_location_is_active(row),
    ).model_dump(mode="json")


def _bank_out(row: LkBankMaster) -> dict:
    swift = row.swift_code
    if swift == "000000000000":
        swift = None
    return BankOut(
        bank_name=row.bank_name,
        bank_code=row.branch_code,
        swift_code=swift,
        is_active=_bank_is_active(row),
    ).model_dump(mode="json")


def _pit_out(row: LkPitBrackets) -> dict:
    return PITBracketOut(
        bracket_no=row.bracket_no,
        lower_bound=float(row.income_from_lak),
        upper_bound=_pit_upper_display(row.income_to_lak),
        rate_pct=float(row.rate_pct),
        deduction_amount=float(row.cumulative_tax_lak),
    ).model_dump(mode="json")


@router.get("/grade-step")
async def get_grade_step(_user: AuthUser, db: AsyncSession = Depends(get_db)) -> dict:
    rows = await master_service.get_all_grade_steps(db)
    return _ok([_grade_step_out(r) for r in rows])


@router.put("/grade-step/{grade}/{step}")
async def put_grade_step(
    _user: ROLE_MASTER_ACCESS,
    grade: int,
    step: int,
    body: GradeStepUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await master_service.update_grade_step(db, grade, step, body)
    return _ok(_grade_step_out(row))


@router.get("/allowance-rates")
async def get_allowance_rates(_user: AuthUser, db: AsyncSession = Depends(get_db)) -> dict:
    rows = await master_service.get_all_allowance_rates(db)
    return _ok([_allowance_out(r) for r in rows])


@router.post("/allowance-rates")
async def post_allowance_rate(
    _user: ROLE_MASTER_ACCESS,
    body: AllowanceRateCreate,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    row = await master_service.create_allowance_rate(db, body)
    return JSONResponse(status_code=201, content=_ok(_allowance_out(row)))


@router.put("/allowance-rates/{name}")
async def put_allowance_rate(
    _user: ROLE_MASTER_ACCESS,
    name: str,
    body: AllowanceRateUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await master_service.update_allowance_rate(db, name, body)
    return _ok(_allowance_out(row))


@router.get("/grade-derivation/derive")
async def get_grade_derivation_derive(
    _user: AuthUser,
    db: AsyncSession = Depends(get_db),
    education_level: str = Query(...),
    prior_experience_years: int = Query(...),
    years_of_service: int = Query(...),
) -> dict:
    result = await master_service.derive_grade(
        db,
        education_level,
        prior_experience_years,
        years_of_service,
    )
    return _ok(result)


@router.get("/grade-derivation")
async def get_grade_derivation(_user: AuthUser, db: AsyncSession = Depends(get_db)) -> dict:
    rows = await master_service.get_all_grade_derivations(db)
    return _ok([_grade_deriv_out(r) for r in rows])


@router.post("/grade-derivation")
async def post_grade_derivation(
    _user: ROLE_MASTER_ACCESS,
    body: GradeDerivationCreate,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    row = await master_service.create_grade_derivation(db, body)
    return JSONResponse(status_code=201, content=_ok(_grade_deriv_out(row)))


@router.put("/grade-derivation/{edu}/{exp}")
async def put_grade_derivation(
    _user: ROLE_MASTER_ACCESS,
    edu: str,
    exp: int,
    body: GradeDerivationUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await master_service.update_grade_derivation(db, edu, exp, body)
    return _ok(_grade_deriv_out(row))


@router.get("/org")
async def get_org(_user: AuthUser, db: AsyncSession = Depends(get_db)) -> dict:
    rows = await master_service.get_all_orgs(db)
    return _ok([_org_out(r) for r in rows])


@router.post("/org")
async def post_org(_user: ROLE_MASTER_ACCESS, body: OrgCreate, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    row = await master_service.create_org(db, body)
    return JSONResponse(status_code=201, content=_ok(_org_out(row)))


@router.put("/org/{ministry_key}/{dept_key}")
async def put_org(
    _user: ROLE_MASTER_ACCESS,
    ministry_key: str,
    dept_key: str,
    body: OrgUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await master_service.update_org(db, ministry_key, dept_key, body)
    return _ok(_org_out(row))


@router.get("/location")
async def get_location(_user: AuthUser, db: AsyncSession = Depends(get_db)) -> dict:
    rows = await master_service.get_all_locations(db)
    return _ok([_location_out(r) for r in rows])


@router.post("/location")
async def post_location(
    _user: ROLE_MASTER_ACCESS,
    body: LocationCreate,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    row = await master_service.create_location(db, body)
    return JSONResponse(status_code=201, content=_ok(_location_out(row)))


@router.put("/location/{province_key}")
async def put_location(
    _user: ROLE_MASTER_ACCESS,
    province_key: str,
    body: LocationUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await master_service.update_location(db, province_key, body)
    return _ok(_location_out(row))


@router.get("/bank")
async def get_bank(_user: AuthUser, db: AsyncSession = Depends(get_db)) -> dict:
    rows = await master_service.get_all_banks(db)
    return _ok([_bank_out(r) for r in rows])


@router.post("/bank")
async def post_bank(_user: ROLE_MASTER_ACCESS, body: BankCreate, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    row = await master_service.create_bank(db, body)
    return JSONResponse(status_code=201, content=_ok(_bank_out(row)))


@router.put("/bank/{bank_name}/{bank_code}")
async def put_bank(
    _user: ROLE_MASTER_ACCESS,
    bank_name: str,
    bank_code: str,
    body: BankUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await master_service.update_bank(db, bank_name, bank_code, body)
    return _ok(_bank_out(row))


@router.get("/pit-brackets")
async def get_pit_brackets(_user: AuthUser, db: AsyncSession = Depends(get_db)) -> dict:
    rows = await master_service.get_all_pit_brackets(db)
    return _ok([_pit_out(r) for r in rows])


@router.put("/pit-brackets/{bracket_no}")
async def put_pit_bracket(
    _user: ROLE_MASTER_ACCESS,
    bracket_no: int,
    body: PITBracketUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await master_service.update_pit_bracket(db, bracket_no, body)
    return _ok(_pit_out(row))


@router.get("/employee-counts")
async def get_master_employee_counts(
    _user: ROLE_MASTER_ACCESS,
    db: AsyncSession = Depends(get_db),
) -> dict:
    async def _compute():
        return await master_service.compute_master_employee_counts(db)

    data = await cached_json(_MASTER_EMPLOYEE_COUNTS_KEY, _compute, ttl=300)
    return _ok(data)
