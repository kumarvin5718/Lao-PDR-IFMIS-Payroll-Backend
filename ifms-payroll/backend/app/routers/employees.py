"""Employee CRUD, export, duplicate checks, and payslip download."""

import os
import tempfile
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.database import get_db
from app.dependencies import ROLE_EMPLOYEE_MANAGER_ADMIN, AuthUser
from app.schemas.employee import EmployeeBatchBody, EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.services import duplicate_check_service as dup_svc
from app.services import employee_export as emp_export
from app.services import employee_service as employee_svc
from app.tasks.reports import export_employees_task

router = APIRouter(prefix="/employees", tags=["employees"])


def _ok(data: object, pagination: dict | None = None) -> dict:
    return {
        "success": True,
        "data": data,
        "pagination": pagination,
        "error": None,
    }


def _unlink(path: str) -> None:
    try:
        os.unlink(path)
    except OSError:
        pass


@router.get("")
async def list_employees(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    ministry: str | None = Query(None),
    grade: int | None = Query(None),
    employment_type: str | None = Query(None),
    is_active: bool | None = Query(None),
) -> dict:
    result = await employee_svc.list_employees(
        db,
        current_user,
        page=page,
        limit=limit,
        search=search,
        ministry=ministry,
        grade=grade,
        employment_type=employment_type,
        is_active=is_active,
    )
    items = [i.model_dump(mode="json") for i in result.items]
    pagination = {
        "page": result.page,
        "limit": result.limit,
        "total": result.total,
        "pages": result.pages,
    }
    return _ok(items, pagination)


@router.get("/check-duplicate")
async def check_duplicate(
    field: str = Query(
        ...,
        description="email|sso_number|civil_service_card_id|bank_account_no|employee_code",
    ),
    value: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if field not in dup_svc.VALID_DUPLICATE_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "ERR_VALIDATION", "message": "Invalid field"},
        )
    result = await dup_svc.check_duplicate(db, field, value)
    return _ok(result)


@router.get("/export")
async def export_employees(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
    export_format: Literal["xlsx", "pdf"] = Query("xlsx", alias="format"),
    ministry: str | None = Query(None),
    grade: int | None = Query(None),
    province: str | None = Query(None),
    employment_type: str | None = Query(None),
    search: str | None = Query(None),
    is_active: bool | None = Query(None),
):
    if current_user.role == "ROLE_EMPLOYEE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ERR_AUTH_FORBIDDEN", "message": "Employees cannot export"},
        )

    n = await emp_export.count_export_rows(
        db,
        current_user,
        ministry=ministry,
        grade=grade,
        province=province,
        employment_type=employment_type,
        search=search,
        is_active=is_active,
    )

    filter_payload = {
        "ministry": ministry,
        "grade": grade,
        "province": province,
        "employment_type": employment_type,
        "search": search,
        "is_active": is_active,
    }
    user_payload = current_user.model_dump()

    if export_format == "pdf":
        if n > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "ERR_EXPORT_TOO_LARGE", "message": "PDF export limited to 1000 rows"},
            )
        rows = await emp_export.fetch_export_rows(
            db,
            current_user,
            ministry=ministry,
            grade=grade,
            province=province,
            employment_type=employment_type,
            search=search,
            is_active=is_active,
            limit=1000,
        )
        fd, path = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        lines = emp_export.build_export_filter_lines(
            ministry=ministry,
            grade=grade,
            province=province,
            employment_type=employment_type,
            search=search,
            is_active=is_active,
        )
        emp_export.write_employees_pdf(
            rows,
            path,
            filter_lines=lines,
            generated_at=datetime.now(timezone.utc),
        )
        return FileResponse(
            path,
            filename="employees_export.pdf",
            media_type="application/pdf",
            background=BackgroundTask(_unlink, path),
        )

    # xlsx — same 1000-row synchronous cap as PDF. Only use Celery when the export is larger
    # (avoids Excel failing when the worker is down while PDF still works for the same filters).
    if n > 1000:
        async_result = export_employees_task.delay(filter_payload, user_payload)
        return _ok({"job_id": async_result.id, "status": "queued"})

    rows = await emp_export.fetch_export_rows(
        db,
        current_user,
        ministry=ministry,
        grade=grade,
        province=province,
        employment_type=employment_type,
        search=search,
        is_active=is_active,
        limit=1000,
    )
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    emp_export.write_employees_xlsx(rows, path)
    return FileResponse(
        path,
        filename="employees_export.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        background=BackgroundTask(_unlink, path),
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_employee(
    body: EmployeeCreate,
    current_user: ROLE_EMPLOYEE_MANAGER_ADMIN,
    db: AsyncSession = Depends(get_db),
) -> dict:
    emp = await employee_svc.create_employee(db, body, current_user)
    out = EmployeeOut.model_validate(emp)
    return _ok(out.model_dump(mode="json"))


@router.post("/batch")
async def batch_create_employees(
    body: EmployeeBatchBody,
    current_user: ROLE_EMPLOYEE_MANAGER_ADMIN,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if len(body.employees) > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_BATCH_TOO_LARGE", "message": "Maximum 200 rows per batch"},
        )
    data = await employee_svc.create_employees_batch(db, current_user, body.employees)
    return _ok(data)


@router.get("/me")
async def get_my_employee(
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    emp = await employee_svc.get_my_employee(db, current_user)
    out = EmployeeOut.model_validate(emp)
    return _ok(out.model_dump(mode="json"))


@router.get("/{code}")
async def get_employee(
    code: str,
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    emp = await employee_svc.get_employee(db, code, current_user)
    out = EmployeeOut.model_validate(emp)
    return _ok(out.model_dump(mode="json"))


@router.put("/{code}")
async def replace_employee(
    code: str,
    body: EmployeeUpdate,
    current_user: ROLE_EMPLOYEE_MANAGER_ADMIN,
    db: AsyncSession = Depends(get_db),
) -> dict:
    emp = await employee_svc.update_employee(db, code, body, current_user)
    out = EmployeeOut.model_validate(emp)
    return _ok(out.model_dump(mode="json"))


@router.delete("/{code}")
async def delete_employee(
    code: str,
    current_user: ROLE_EMPLOYEE_MANAGER_ADMIN,
    db: AsyncSession = Depends(get_db),
) -> dict:
    emp = await employee_svc.deactivate_employee(db, code, current_user)
    out = EmployeeOut.model_validate(emp)
    return _ok(out.model_dump(mode="json"))
