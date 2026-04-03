import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import ROLE_AUDIT_LOG_VIEW, ROLE_FINANCE_PLUS, AuthUser
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogRow

router = APIRouter(prefix="/reports", tags=["reports"])

STUB = {"success": False, "data": None, "pagination": None, "error": None}


def _ok(data: object, pagination: dict | None = None) -> dict:
    return {"success": True, "data": data, "pagination": pagination, "error": None}


def _paginated_ok(
    items: list[dict],
    *,
    page: int,
    limit: int,
    total: int,
) -> dict:
    pages = (total + limit - 1) // limit if limit > 0 else 0
    return {
        "success": True,
        "data": items,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": pages},
        "error": None,
    }


def _async_job_response(job_id: str) -> dict:
    return {
        "success": True,
        "data": {"job_id": job_id},
        "pagination": None,
        "error": None,
    }


def _parse_iso_date(name: str, value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{name} must be YYYY-MM-DD",
        ) from exc


def _day_start_utc(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _audit_filters(
    *,
    table: str | None,
    from_date: str | None,
    to_date: str | None,
    changed_by: str | None,
    circular_ref: str | None,
) -> list:
    conds: list = []
    if table is not None:
        conds.append(AuditLog.table_name == table)
    if from_date is not None:
        d0 = _parse_iso_date("from", from_date)
        conds.append(AuditLog.changed_at >= _day_start_utc(d0))
    if to_date is not None:
        d1 = _parse_iso_date("to", to_date)
        conds.append(AuditLog.changed_at < _day_start_utc(d1 + timedelta(days=1)))
    if changed_by:
        conds.append(AuditLog.changed_by.ilike(f"%{changed_by}%"))
    if circular_ref:
        conds.append(AuditLog.circular_ref.ilike(f"%{circular_ref}%"))
    return conds


@router.get("/payroll-register")
async def report_payroll_register(
    _user: AuthUser,
    month: str | None = Query(None),
    ministry: str | None = Query(None),
    export: str | None = Query(None, description="pdf|xlsx"),
) -> dict:
    """TODO: GET /reports/payroll-register"""
    return STUB


@router.get("/payslip/{code}/{month}")
async def report_payslip(
    _user: AuthUser,
    code: str,
    month: str,
    export: str | None = Query(None, description="pdf"),
) -> dict:
    """TODO: GET /reports/payslip/{code}/{month}"""
    return STUB


@router.get("/ministry-summary")
async def report_ministry_summary(
    _user: AuthUser,
    month: str | None = Query(None),
    export: str | None = Query(None, description="xlsx"),
) -> dict:
    """TODO: GET /reports/ministry-summary"""
    return STUB


@router.get("/employee-list")
async def report_employee_list(
    _user: AuthUser,
    ministry: str | None = Query(None),
    grade: int | None = Query(None),
    province: str | None = Query(None),
    export: str | None = Query(None, description="xlsx"),
) -> dict:
    """TODO: GET /reports/employee-list"""
    return STUB


@router.get("/allowance-breakdown")
async def report_allowance_breakdown(
    _user: ROLE_FINANCE_PLUS,
    month: str | None = Query(None),
    ministry: str | None = Query(None),
    export: str | None = Query(None, description="xlsx"),
) -> dict:
    """TODO: GET /reports/allowance-breakdown — ROLE_FINANCE+"""
    return STUB


@router.get("/sso")
async def report_sso(
    _user: ROLE_FINANCE_PLUS,
    month: str | None = Query(None),
    export: str | None = Query(None, description="xlsx"),
) -> dict:
    """TODO: GET /reports/sso — ROLE_FINANCE+"""
    return STUB


@router.get("/pit")
async def report_pit(
    _user: ROLE_FINANCE_PLUS,
    month: str | None = Query(None),
    ministry: str | None = Query(None),
    export: str | None = Query(None, description="xlsx"),
) -> dict:
    """TODO: GET /reports/pit — ROLE_FINANCE+"""
    return STUB


@router.get("/retirements")
async def report_retirements(
    _user: AuthUser,
    months_ahead: int | None = Query(None),
    ministry: str | None = Query(None),
    export: str | None = Query(None, description="xlsx"),
) -> dict:
    """TODO: GET /reports/retirements"""
    return STUB


@router.get("/foreign-postings")
async def report_foreign_postings(
    _user: ROLE_FINANCE_PLUS,
    month: str | None = Query(None),
    export: str | None = Query(None, description="xlsx"),
) -> dict:
    """TODO: GET /reports/foreign-postings — ROLE_FINANCE+"""
    return STUB


@router.get("/audit-log")
async def report_audit_log(
    current_user: ROLE_AUDIT_LOG_VIEW,
    db: AsyncSession = Depends(get_db),
    table: str | None = Query(None),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    changed_by: str | None = Query(None),
    circular_ref: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    export: str | None = Query(None, description="xlsx triggers async Celery job"),
) -> dict:
    """GET /reports/audit-log — ROLE_FINANCE, ROLE_ADMIN, ROLE_AUDITOR."""
    conds = _audit_filters(
        table=table,
        from_date=from_date,
        to_date=to_date,
        changed_by=changed_by,
        circular_ref=circular_ref,
    )

    if export == "xlsx":
        from app.tasks.reports import export_audit_log_task

        async_result = export_audit_log_task.delay(
            table,
            from_date,
            to_date,
            changed_by,
            circular_ref,
            current_user.full_name,
        )
        return _async_job_response(async_result.id)

    limit = min(limit, 500)

    count_stmt = select(func.count()).select_from(AuditLog)
    list_stmt = select(AuditLog).order_by(AuditLog.changed_at.desc())
    if conds:
        filt = and_(*conds)
        count_stmt = count_stmt.where(filt)
        list_stmt = list_stmt.where(filt)

    total = int(await db.scalar(count_stmt) or 0)

    offset = (page - 1) * limit
    list_stmt = list_stmt.offset(offset).limit(limit)
    result = await db.execute(list_stmt)
    rows = result.scalars().all()
    items = [AuditLogRow.model_validate(r).model_dump(mode="json") for r in rows]
    return _paginated_ok(items, page=page, limit=limit, total=total)


@router.get("/jobs/{job_id}")
async def report_job_status(_user: AuthUser, job_id: str) -> dict:
    """Poll Celery async report job (e.g. audit XLSX export)."""
    from celery.result import AsyncResult

    from app.celery_app import celery_app

    r = AsyncResult(job_id, app=celery_app)
    if not r.ready():
        return _ok({"state": r.state, "result": None, "error": None})
    if r.failed():
        err = r.result
        msg = str(err) if err is not None else "task_failed"
        return _ok({"state": "FAILURE", "result": None, "error": msg})
    return _ok({"state": "SUCCESS", "result": r.result, "error": None})


@router.get("/download/{filename}")
async def download_report_file(filename: str, _user: AuthUser) -> FileResponse:
    """Download a generated report file from REPORTS_DIR (basename only). Any authenticated user."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
    safe = Path(filename).name
    if not re.match(r"^[A-Za-z0-9._-]+\.(xlsx|pdf)$", safe):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
    reports_dir = os.environ.get("REPORTS_DIR") or get_settings().REPORTS_DIR
    path = os.path.join(reports_dir, safe)
    if not os.path.isfile(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or expired",
        )
    media = (
        "application/pdf"
        if safe.lower().endswith(".pdf")
        else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    return FileResponse(path, filename=safe, media_type=media)
