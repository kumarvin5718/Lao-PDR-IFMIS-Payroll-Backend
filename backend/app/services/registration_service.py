"""Self-registration and pending-registration approval (Phase 4 Slice 2)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_user import AppUser
from app.models.employee import Employee
from app.models.lk_allowance_rates import LkAllowanceRates
from app.models.lk_bank_master import LkBankMaster
from app.models.lk_location_master import LkLocationMaster
from app.models.lk_org_master import LkOrgMaster
from app.schemas.auth import User
from app.schemas.registration import RegistrationRequest
from app.services.user_service import _gen_temp_password, pwd_ctx
from app.utils.scope import get_manager_scope


async def _next_employee_code(db: AsyncSession) -> str:
    result = await db.execute(
        select(Employee.employee_code)
        .where(Employee.employee_code.like("LAO%"))
        .order_by(Employee.employee_code.desc())
        .limit(1),
    )
    row = result.scalar_one_or_none()
    if row is None:
        return "LAO00001"
    try:
        n = int(row[3:]) + 1
    except ValueError:
        n = 1
    return f"LAO{n:05d}"


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if not parts:
        return "Unknown", "Unknown"
    if len(parts) == 1:
        return parts[0], parts[0]
    return parts[0], " ".join(parts[1:])


async def _registration_placeholders(db: AsyncSession) -> tuple[str, str, str, str]:
    bank = await db.scalar(select(LkBankMaster).limit(1))
    if bank is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ERR_DB_SCHEMA_INCOMPLETE", "message": "lk_bank_master is empty"},
        )
    allowance = await db.scalar(select(LkAllowanceRates.allowance_name).order_by(LkAllowanceRates.allowance_name.asc()).limit(1))
    if allowance is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ERR_DB_SCHEMA_INCOMPLETE", "message": "lk_allowance_rates is empty"},
        )
    return bank.bank_name, bank.branch_name, allowance, bank.swift_code


async def register_employee(db: AsyncSession, payload: RegistrationRequest) -> tuple[str, str]:
    """Returns (employee_code, discarded_password_hash_context — not used). Creates user + stub."""
    sso = payload.sso_number
    dup_sso = await db.scalar(select(Employee.employee_code).where(Employee.sso_number == sso))
    if dup_sso is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_EMP_SSO_DUPLICATE", "message": "SSO number already registered"},
        )

    dup_email = await db.scalar(
        select(AppUser.user_id).where(func.lower(AppUser.email) == str(payload.email).lower()),
    )
    if dup_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_USER_EMAIL_DUPLICATE", "message": "Email already registered"},
        )

    loc_ok = await db.scalar(select(LkLocationMaster.province).where(LkLocationMaster.province == payload.location))
    if loc_ok is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_EMP_FK_PROVINCE", "message": "Invalid service location / province"},
        )

    org = await db.scalar(select(LkOrgMaster).where(LkOrgMaster.department_name == payload.department_name).limit(1))
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_EMP_FK_MINISTRY", "message": "Invalid department"},
        )

    bank_name, branch_name, position_level, swift = await _registration_placeholders(db)

    employee_code = await _next_employee_code(db)
    first_name, last_name = _split_name(payload.full_name)
    # Unique placeholders for CSC and bank account (12 / 20 char limits)
    digits = sso[3:]  # 7 digits
    civil_id = f"RG{digits}REG"  # 12 chars: RG + 7 digits + REG
    bank_acct = f"REG-{employee_code}"[:20]

    plain = _gen_temp_password(12)
    password_hash = pwd_ctx.hash(plain)
    del plain

    username = sso.lower()
    now = datetime.now(timezone.utc)
    today = date.today()

    user = AppUser(
        username=username,
        full_name=payload.full_name.strip(),
        email=str(payload.email),
        password_hash=password_hash,
        role="ROLE_EMPLOYEE",
        registration_status="PENDING",
        preferred_language="en",
        is_active=False,
        force_password_change=True,
        failed_login_count=0,
        locked_until=None,
    )
    db.add(user)
    await db.flush()

    emp = Employee(
        employee_code=employee_code,
        title="Mr.",
        first_name=first_name,
        last_name=last_name,
        gender="Male",
        date_of_birth=date(1990, 1, 1),
        email=str(payload.email),
        mobile_number=payload.phone_number,
        date_of_joining=today,
        employment_type="Permanent",
        position_title="Registration pending",
        education_level="Pending",
        prior_experience_years=0,
        grade=1,
        step=1,
        civil_service_card_id=civil_id,
        sso_number=sso,
        ministry_name=org.ministry_name,
        department_name=payload.department_name,
        division_name=None,
        service_country="Lao PDR",
        service_province=payload.location,
        service_district=None,
        profession_category=org.profession_category,
        is_remote_area=False,
        is_foreign_posting=False,
        is_hazardous_area=False,
        bank_name=bank_name,
        bank_branch=branch_name,
        bank_branch_code=None,
        bank_account_no=bank_acct,
        swift_code=swift,
        has_spouse=False,
        eligible_children=0,
        position_level=position_level,
        is_na_member=False,
        field_allowance_type="None",
        is_active=False,
        created_at=now,
        created_by="SELF_REGISTRATION",
        uploaded_by_user_id=None,
        owner_role="ROLE_EMPLOYEE",
        registration_status="PENDING",
    )
    db.add(emp)
    await db.commit()
    return employee_code, ""


async def list_pending_registrations(
    db: AsyncSession,
    current_user: User,
    page: int,
    limit: int,
) -> tuple[list[dict], int]:
    scope_filter = None
    if current_user.role == "ROLE_MANAGER":
        scope = await get_manager_scope(db, current_user.user_id)
        if not scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ERR_SCOPE_NOT_FOUND", "message": "No scope assigned to this manager"},
            )
        scope_filter = or_(
            *[
                and_(
                    Employee.service_province == s["location"],
                    Employee.department_name == s["department_name"],
                )
                for s in scope
            ],
        )

    count_stmt = (
        select(func.count())
        .select_from(AppUser)
        .join(Employee, Employee.email == AppUser.email)
        .where(AppUser.role == "ROLE_EMPLOYEE")
        .where(AppUser.registration_status == "PENDING")
    )
    if scope_filter is not None:
        count_stmt = count_stmt.where(scope_filter)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = (
        select(AppUser, Employee)
        .join(Employee, Employee.email == AppUser.email)
        .where(AppUser.role == "ROLE_EMPLOYEE")
        .where(AppUser.registration_status == "PENDING")
    )
    if scope_filter is not None:
        stmt = stmt.where(scope_filter)
    stmt = (
        stmt.order_by(AppUser.created_at.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    items: list[dict] = []
    for u, e in rows:
        items.append(
            {
                "user_id": str(u.user_id),
                "full_name": u.full_name,
                "email": u.email,
                "sso_number": e.sso_number,
                "location": e.service_province,
                "department_name": e.department_name,
                "submitted_at": u.created_at.isoformat() if u.created_at else None,
                "registration_status": u.registration_status,
            },
        )
    return items, total


async def _load_pending_user_employee(
    db: AsyncSession,
    user_id: str,
) -> tuple[AppUser, Employee]:
    uid = UUID(user_id)
    user = await db.scalar(select(AppUser).where(AppUser.user_id == uid))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "ERR_USER_NOT_FOUND", "message": "User not found"})
    if user.registration_status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_REG_INVALID_STATE", "message": "Registration is not pending"},
        )
    emp = await db.scalar(select(Employee).where(Employee.email == user.email))
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "ERR_REG_NO_EMPLOYEE", "message": "Employee stub missing"},
        )
    return user, emp


async def assert_manager_can_access_registration(
    db: AsyncSession,
    current_user: User,
    emp: Employee,
) -> None:
    if current_user.role == "ROLE_ADMIN":
        return
    if current_user.role != "ROLE_MANAGER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ERR_AUTH_FORBIDDEN")
    scope = await get_manager_scope(db, current_user.user_id)
    if not scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ERR_SCOPE_NOT_FOUND", "message": "No scope assigned to this manager"},
        )
    if not any(
        emp.service_province == s["location"] and emp.department_name == s["department_name"] for s in scope
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ERR_AUTH_FORBIDDEN", "message": "Registration outside your scope"},
        )


async def approve_registration(db: AsyncSession, current_user: User, user_id: str) -> str:
    user, emp = await _load_pending_user_employee(db, user_id)
    await assert_manager_can_access_registration(db, current_user, emp)

    plain = _gen_temp_password(12)
    new_hash = pwd_ctx.hash(plain)

    user.registration_status = "ACTIVE"
    user.is_active = True
    user.force_password_change = True
    user.password_hash = new_hash

    emp.registration_status = "ACTIVE"
    emp.is_active = True
    emp.uploaded_by_user_id = user.user_id

    await db.commit()
    return plain


async def reject_registration(db: AsyncSession, current_user: User, user_id: str) -> None:
    user, emp = await _load_pending_user_employee(db, user_id)
    await assert_manager_can_access_registration(db, current_user, emp)

    user.registration_status = "REJECTED"
    user.is_active = False

    emp.registration_status = "REJECTED"
    emp.is_active = False

    await db.commit()
