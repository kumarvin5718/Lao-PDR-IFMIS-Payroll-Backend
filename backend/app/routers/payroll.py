"""Payroll monthly run, approval, lock/unlock, and async job status endpoints."""

from typing import Annotated

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery_app
from app.config import get_settings
from app.database import get_db
from app.dependencies import ROLE_ADMIN_ONLY, ROLE_FINANCE_PLUS, get_current_user
from app.models import Employee
from app.models.celery_task_result import CeleryTaskResult
from app.tasks.payroll_tasks import run_payroll_job
from app.schemas.auth import User
from app.schemas.payroll import (
    PayrollApproveRequest,
    PayrollFreeFieldPatch,
    PayrollLockRequest,
    PayrollRunRequest,
    PayrollUnlockRequest,
)
from app.services import payroll_service

router = APIRouter(prefix="/payroll", tags=["payroll"])


async def _approve_payroll_user(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role not in ("ROLE_MANAGER", "ROLE_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ERR_AUTH_FORBIDDEN")
    return user


ApprovePayrollUser = Annotated[User, Depends(_approve_payroll_user)]


def _ok(data: object, pagination: dict | None = None) -> dict:
    return {"success": True, "data": data, "pagination": pagination, "error": None}


@router.post("/run")
async def run_payroll(
    body: PayrollRunRequest,
    current_user: ROLE_FINANCE_PLUS,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await payroll_service.validate_payroll_run_prerequisites(db, body, current_user)
    settings = get_settings()
    if settings.PAYROLL_RUN_SYNC:
        result = await payroll_service.run_payroll_month(db, body, current_user)
        return _ok({"job_id": None, "status": "COMPLETED", **result})
    task = run_payroll_job.delay(
        month=body.month,
        ministry_filter=body.ministry_filter,
        user_payload=current_user.model_dump(),
    )
    return _ok(
        {
            "job_id": task.id,
            "status": "QUEUED",
            "month": body.month,
            "ministry_filter": body.ministry_filter,
        }
    )


@router.get("/run/jobs/{job_id}")
async def get_payroll_run_job(
    job_id: str,
    current_user: ROLE_FINANCE_PLUS,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await db.scalar(select(CeleryTaskResult).where(CeleryTaskResult.task_id == job_id))
    if row is None:
        ar = AsyncResult(job_id, app=celery_app)
        if ar.state in ("FAILURE", "FAIL", "REVOKED"):
            return _ok(
                {
                    "job_id": job_id,
                    "status": "FAILURE",
                    "result": None,
                    "error": {"message": str(ar.result) if ar.result else "Task failed"},
                }
            )
        return _ok(
            {
                "job_id": job_id,
                "status": "QUEUED",
                "result": None,
                "error": None,
            }
        )
    err: dict | None = None
    if row.result and isinstance(row.result, dict) and "error" in row.result:
        err = row.result["error"] if isinstance(row.result["error"], dict) else {"message": str(row.result["error"])}
    elif row.status == "FAILURE":
        err = {"message": row.traceback or "Payroll run failed"}
    return _ok(
        {
            "job_id": row.task_id,
            "status": row.status,
            "result": row.result if row.status == "SUCCESS" else None,
            "error": err if row.status == "FAILURE" else None,
        }
    )


@router.get("/monthly")
async def list_monthly_payroll(
    current_user: ROLE_FINANCE_PLUS,
    db: AsyncSession = Depends(get_db),
    month: str | None = Query(None),
    ministry: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    payroll_status: str | None = Query(None, alias="status"),
) -> dict:
    result = await payroll_service.list_payroll(
        db,
        current_user,
        month,
        ministry,
        page,
        limit,
        status_filter=payroll_status,
    )
    pagination = {
        "page": result["page"],
        "limit": result["limit"],
        "total": result["total"],
        "pages": result["pages"],
    }
    return _ok(result["items"], pagination)


@router.patch("/monthly/{code}/{month}")
async def patch_monthly_payroll(
    code: str,
    month: str,
    body: PayrollFreeFieldPatch,
    current_user: ROLE_FINANCE_PLUS,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await payroll_service.patch_free_fields(db, code, month, body, current_user)
    emp = await db.scalar(select(Employee).where(Employee.employee_code == code))
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_EMP_NOT_FOUND", "message": "Employee not found"},
        )
    out = await payroll_service.payroll_row_to_out(db, row, emp)
    return _ok(out.model_dump(mode="json"))


@router.post("/approve")
async def approve_payroll(
    body: PayrollApproveRequest,
    current_user: ApprovePayrollUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await payroll_service.approve_payroll(db, body, current_user)
    return _ok(result)


@router.post("/lock")
async def lock_payroll(
    body: PayrollLockRequest,
    current_user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await payroll_service.lock_payroll(db, body, current_user)
    return _ok(result)


@router.post("/unlock")
async def unlock_payroll(
    body: PayrollUnlockRequest,
    current_user: ROLE_ADMIN_ONLY,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await payroll_service.unlock_payroll(db, body, current_user)
    return _ok(result)
