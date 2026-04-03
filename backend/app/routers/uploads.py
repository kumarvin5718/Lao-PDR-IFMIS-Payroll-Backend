from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import ROLE_HR_PLUS
from app.services import upload_service

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _ok(data: dict) -> dict:
    return {"success": True, "data": data, "pagination": None, "error": None}


@router.get("/employees/template")
async def download_employee_template() -> Response:
    template_bytes = upload_service.get_template()
    return Response(
        content=template_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="employee_upload_template.xlsx"'},
    )


@router.post("/employees/parse")
async def parse_employees(
    current_user: ROLE_HR_PLUS,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await upload_service.parse_upload(db, file, current_user)
    return _ok(result)


@router.post("/employees/commit/{session_id}")
async def commit_employees(
    session_id: UUID,
    current_user: ROLE_HR_PLUS,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await upload_service.commit_upload(db, session_id, current_user)
    return _ok(result)
