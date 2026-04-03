from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import AuthUser, ROLE_ADMIN_ONLY, require_role
from app.schemas.auth import User
from app.services import dashboard_service as ds

MANAGER_STATS_USER = Annotated[User, Depends(require_role(["ROLE_ADMIN", "ROLE_DEPT_OFFICER", "ROLE_MANAGER"]))]

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _ok(data: object) -> dict:
    return {"success": True, "data": data, "pagination": None, "error": None}


@router.get("/dept-stats")
async def dept_stats(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    dept: str = Query(..., min_length=1),
) -> dict:
    d = dept.strip()
    key = ds.cache_key_stat("dept-stats", current_user.user_id, d)

    async def compute() -> dict:
        return await ds.dept_stats(db, current_user, d)

    return _ok(await ds.cached_json(key, compute))


@router.get("/location-stats")
async def location_stats(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    location: str = Query(..., min_length=1),
) -> dict:
    loc = location.strip()
    key = ds.cache_key_stat("location-stats", current_user.user_id, loc)

    async def compute() -> dict:
        return await ds.location_stats(db, current_user, loc)

    return _ok(await ds.cached_json(key, compute))


@router.get("/manager-stats")
async def manager_stats(
    current_user: MANAGER_STATS_USER,
    db: AsyncSession = Depends(get_db),
    manager_user_id: UUID = Query(..., description="Manager app_user.user_id"),
) -> dict:
    key = ds.cache_key_stat("manager-stats", current_user.user_id, str(manager_user_id))

    async def compute() -> dict:
        return await ds.manager_stats(db, current_user, manager_user_id)

    return _ok(await ds.cached_json(key, compute))


@router.get("/summary")
async def summary(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    dept: str | None = Query(None),
    location: str | None = Query(None),
) -> dict:
    key = ds.cache_key("summary", current_user.user_id, dept, location)

    async def compute() -> dict:
        return await ds.get_summary(db, current_user, dept, location)

    return _ok(await ds.cached_json(key, compute))


@router.get("/headcount-dept")
async def headcount_dept(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    dept: str | None = Query(None),
    location: str | None = Query(None),
) -> dict:
    key = ds.cache_key("headcount-dept", current_user.user_id, dept, location)

    async def compute() -> dict:
        return await ds.headcount_by_department(db, current_user, dept, location)

    return _ok(await ds.cached_json(key, compute))


@router.get("/headcount-location")
async def headcount_location(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    dept: str | None = Query(None),
    location: str | None = Query(None),
) -> dict:
    key = ds.cache_key("headcount-location", current_user.user_id, dept, location)

    async def compute() -> dict:
        return await ds.headcount_by_location(db, current_user, dept, location)

    return _ok(await ds.cached_json(key, compute))


@router.get("/fill-rate")
async def fill_rate(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    dept: str | None = Query(None),
    location: str | None = Query(None),
) -> dict:
    key = ds.cache_key("fill-rate", current_user.user_id, dept, location)

    async def compute() -> dict:
        return await ds.fill_rate_by_department(db, current_user, dept, location)

    return _ok(await ds.cached_json(key, compute))


@router.get("/grade-dist")
async def grade_dist(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    dept: str | None = Query(None),
    location: str | None = Query(None),
) -> dict:
    key = ds.cache_key("grade-dist", current_user.user_id, dept, location)

    async def compute() -> dict:
        return await ds.grade_distribution(db, current_user, dept, location)

    return _ok(await ds.cached_json(key, compute))


@router.get("/employment-mix")
async def employment_mix(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    dept: str | None = Query(None),
    location: str | None = Query(None),
) -> dict:
    key = ds.cache_key("employment-mix", current_user.user_id, dept, location)

    async def compute() -> dict:
        return await ds.employment_mix(db, current_user, dept, location)

    return _ok(await ds.cached_json(key, compute))


@router.get("/payroll-trend")
async def payroll_trend(
    current_user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    key = ds.cache_key("payroll-trend", current_user.user_id, None, None)

    async def compute() -> dict:
        return await ds.payroll_trend(db)

    return _ok(await ds.cached_json(key, compute))
