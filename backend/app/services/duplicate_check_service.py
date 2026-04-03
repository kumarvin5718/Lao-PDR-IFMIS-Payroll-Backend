"""Public duplicate checks for registration and forms."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_user import AppUser
from app.models.employee import Employee

VALID_DUPLICATE_FIELDS = frozenset(
    {"email", "sso_number", "civil_service_card_id", "bank_account_no", "employee_code"},
)


async def check_duplicate(db: AsyncSession, field: str, value: str) -> dict:
    v = value.strip()
    if not v:
        return {"is_duplicate": False, "existing_code": None}

    if field == "email":
        has = await db.scalar(select(AppUser.user_id).where(func.lower(AppUser.email) == v.lower()))
        if has is None:
            return {"is_duplicate": False, "existing_code": None}
        code = await db.scalar(select(Employee.employee_code).where(func.lower(Employee.email) == v.lower()))
        return {"is_duplicate": True, "existing_code": code}

    if field == "sso_number":
        code = await db.scalar(select(Employee.employee_code).where(Employee.sso_number == v))
        if code is None:
            return {"is_duplicate": False, "existing_code": None}
        return {"is_duplicate": True, "existing_code": code}

    if field == "civil_service_card_id":
        code = await db.scalar(select(Employee.employee_code).where(Employee.civil_service_card_id == v))
        if code is None:
            return {"is_duplicate": False, "existing_code": None}
        return {"is_duplicate": True, "existing_code": code}

    if field == "bank_account_no":
        code = await db.scalar(select(Employee.employee_code).where(Employee.bank_account_no == v))
        if code is None:
            return {"is_duplicate": False, "existing_code": None}
        return {"is_duplicate": True, "existing_code": code}

    if field == "employee_code":
        code = await db.scalar(select(Employee.employee_code).where(Employee.employee_code == v))
        if code is None:
            return {"is_duplicate": False, "existing_code": None}
        return {"is_duplicate": True, "existing_code": code}

    return {"is_duplicate": False, "existing_code": None}
