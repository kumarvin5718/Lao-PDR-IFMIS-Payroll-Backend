"""Payroll archive listing and retrieval (stub/placeholder routes)."""

from fastapi import APIRouter, Query

from app.dependencies import ROLE_ADMIN_ONLY, ROLE_FINANCE_PLUS

router = APIRouter(prefix="/archive", tags=["archive"])

STUB = {"success": False, "data": None, "pagination": None, "error": None}


@router.get("/payroll")
async def list_archived_payroll(
    _user: ROLE_FINANCE_PLUS,
    month: str | None = Query(None),
    ministry: str | None = Query(None),
    page: int | None = Query(None),
    limit: int | None = Query(None),
) -> dict:
    """TODO: GET /archive/payroll"""
    return STUB


@router.post("/trigger")
async def trigger_archive(_user: ROLE_ADMIN_ONLY) -> dict:
    """TODO: POST /archive/trigger"""
    return STUB
