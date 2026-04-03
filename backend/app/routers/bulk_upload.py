from fastapi import APIRouter, HTTPException, Query, status

from app.dependencies import ROLE_FINANCE_PLUS, ROLE_HR_PLUS

router = APIRouter(prefix="/bulk-upload", tags=["bulk-upload"])


def _not_implemented() -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "ERR_NOT_IMPLEMENTED",
            "message": "Payroll free-fields bulk upload is not implemented in this release.",
        },
    )


@router.get("/payroll-free-fields/template")
async def download_payroll_free_fields_template(
    _user: ROLE_FINANCE_PLUS,
    month: str | None = Query(None, description="e.g. 2026-03"),
) -> dict:
    _not_implemented()


@router.post("/payroll-free-fields/validate")
async def validate_payroll_free_fields(_user: ROLE_FINANCE_PLUS) -> dict:
    _not_implemented()


@router.post("/payroll-free-fields/confirm")
async def confirm_payroll_free_fields(_user: ROLE_FINANCE_PLUS) -> dict:
    _not_implemented()


@router.get("/employee/template")
async def legacy_employee_template(_user: ROLE_HR_PLUS) -> dict:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail={
            "code": "ERR_UPLOAD_ENDPOINT_MOVED",
            "message": "Use GET /api/v1/uploads/employees/template instead.",
        },
    )


@router.post("/employee/validate")
async def legacy_employee_validate(_user: ROLE_HR_PLUS) -> dict:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail={
            "code": "ERR_UPLOAD_ENDPOINT_MOVED",
            "message": "Use POST /api/v1/uploads/employees/parse instead.",
        },
    )


@router.get("/employee/error-report/{session_id}")
async def legacy_employee_error_report(_user: ROLE_HR_PLUS, session_id: str) -> dict:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail={
            "code": "ERR_UPLOAD_ENDPOINT_MOVED",
            "message": "Validation results are returned inline from POST /api/v1/uploads/employees/parse.",
        },
    )


@router.post("/employee/confirm")
async def legacy_employee_confirm(_user: ROLE_HR_PLUS) -> dict:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail={
            "code": "ERR_UPLOAD_ENDPOINT_MOVED",
            "message": "Use POST /api/v1/uploads/employees/commit/{session_id} instead.",
        },
    )
