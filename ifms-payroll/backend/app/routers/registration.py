"""Self-service registration request (pending admin approval)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.registration import RegistrationRequest, RegistrationResponse
from app.services import registration_service as reg_svc

router = APIRouter(prefix="/auth", tags=["registration"])


def _ok(data: object) -> dict:
    return {"success": True, "data": data, "pagination": None, "error": None}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegistrationRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    employee_code, _ = await reg_svc.register_employee(db, body)
    return _ok(
        RegistrationResponse(
            message="Registration submitted. Awaiting manager approval.",
            employee_code=employee_code,
        ).model_dump(),
    )
