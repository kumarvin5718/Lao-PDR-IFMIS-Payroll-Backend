"""Employee business logic: list filters, CRUD, scope rules, validation."""

from datetime import date, datetime, timezone
from math import ceil
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy import String, and_, cast, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_user import AppUser
from app.models.employee import Employee
from app.schemas.auth import User
from app.schemas.employee import EmployeeCreate, EmployeeListItem, EmployeeListResponse, EmployeeUpdate
from app.services import duplicate_check_service as dup_svc
from app.services.registration_service import _next_employee_code
from app.utils.audit_session import set_audit_change_remarks
from app.utils.scope import (
    assert_employee_accessible,
    employee_scope_clause,
    get_manager_scope,
)


async def list_employees(
    db: AsyncSession,
    current_user: User,
    page: int = 1,
    limit: int = 50,
    search: str | None = None,
    ministry: str | None = None,
    grade: int | None = None,
    employment_type: str | None = None,
    is_active: bool | None = None,
) -> EmployeeListResponse:
    scope = await employee_scope_clause(db, current_user)
    conditions: list = []
    if scope is not None:
        conditions.append(scope)

    if current_user.role == "ROLE_ADMIN" and ministry and ministry.strip():
        conditions.append(Employee.ministry_name == ministry.strip())

    if grade is not None:
        conditions.append(Employee.grade == grade)
    if employment_type is not None and employment_type.strip():
        conditions.append(Employee.employment_type == employment_type)
    if is_active is not None:
        conditions.append(Employee.is_active == is_active)

    if search is not None and len(search.strip()) >= 2:
        term = f"%{search.strip()}%"
        grade_str = cast(Employee.grade, String)
        conditions.append(
            or_(
                Employee.employee_code.ilike(term),
                Employee.first_name.ilike(term),
                Employee.last_name.ilike(term),
                Employee.civil_service_card_id.ilike(term),
                grade_str.ilike(term),
            ),
        )

    wc = and_(*conditions) if conditions else None

    count_stmt = select(func.count()).select_from(Employee)
    stmt = select(Employee)
    if wc is not None:
        count_stmt = count_stmt.where(wc)
        stmt = stmt.where(wc)
    stmt = stmt.order_by(Employee.employee_code.asc()).offset((page - 1) * limit).limit(limit)
    count_result = await db.execute(count_stmt)
    total = count_result.scalar_one()
    result = await db.execute(stmt)
    rows = result.scalars().all()

    pages = ceil(total / limit) if total > 0 else 1
    return EmployeeListResponse(
        items=[EmployeeListItem.model_validate(e) for e in rows],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


async def get_employee(db: AsyncSession, code: str, current_user: User) -> Employee:
    result = await db.execute(select(Employee).where(Employee.employee_code == code))
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_EMP_NOT_FOUND", "message": "Employee not found"},
        )
    await assert_employee_accessible(db, emp, current_user)
    return emp


async def get_my_employee(db: AsyncSession, current_user: User) -> Employee:
    """Current user's employee row: uploaded_by_user_id match, else email match (app_user).

    Does not use assert_employee_accessible so ROLE_EMPLOYEE can resolve by email when
    uploaded_by_user_id is unset but app_user.email matches employee.email.
    """
    uid = UUID(current_user.user_id)
    user_row = await db.scalar(select(AppUser).where(AppUser.user_id == uid))
    if user_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_EMP_NOT_FOUND", "message": "Employee not found"},
        )
    emp = await db.scalar(select(Employee).where(Employee.uploaded_by_user_id == uid))
    if emp is None:
        emp = await db.scalar(
            select(Employee).where(func.lower(Employee.email) == user_row.email.lower()),
        )
    if emp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_EMP_NOT_FOUND", "message": "Employee not found"},
        )
    return emp


async def _check_duplicate(
    db: AsyncSession,
    field: str,
    value: str,
    err_code: str,
    exclude_code: str | None = None,
) -> None:
    col = getattr(Employee, field)
    stmt = select(func.count()).select_from(Employee).where(col == value)
    if exclude_code is not None:
        stmt = stmt.where(Employee.employee_code != exclude_code)
    n = (await db.execute(stmt)).scalar_one()
    if n > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": err_code, "message": err_code},
        )


async def create_employee(
    db: AsyncSession,
    body: EmployeeCreate,
    current_user: User,
) -> Employee:
    if current_user.role == "ROLE_DEPT_OFFICER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ERR_EMP_OWNERSHIP_DENIED", "message": "Department officers cannot create employees"},
        )

    if current_user.role == "ROLE_MANAGER":
        scope = await get_manager_scope(db, current_user.user_id)
        if not scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "ERR_SCOPE_NOT_FOUND", "message": "No scope assigned to this manager"},
            )
        if not any(
            body.service_province == s["location"] and body.department_name == s["department_name"] for s in scope
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_AUTH_MINISTRY_SCOPE",
                    "message": "Cannot create employee outside your location/department scope",
                },
            )

    if body.employee_code is None or not str(body.employee_code).strip():
        code = await _next_employee_code(db)
        body = body.model_copy(update={"employee_code": code})

    await _check_duplicate(db, "employee_code", body.employee_code, "ERR_EMP_CODE_DUPLICATE")
    await _check_duplicate(db, "email", body.email, "ERR_EMP_EMAIL_DUPLICATE")
    await _check_duplicate(db, "civil_service_card_id", body.civil_service_card_id, "ERR_EMP_CSC_DUPLICATE")
    await _check_duplicate(db, "bank_account_no", body.bank_account_no, "ERR_EMP_BANK_ACCT_DUPLICATE")
    if body.sso_number and str(body.sso_number).strip():
        await _check_duplicate(db, "sso_number", str(body.sso_number).strip(), "ERR_EMP_SSO_DUPLICATE")

    today = date.today()
    age = (today - body.date_of_birth).days // 365
    if age < 18 or age > 65:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_EMP_INVALID_DOB", "message": "Invalid date of birth"},
        )
    if body.date_of_joining > today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_EMP_INVALID_JOINING", "message": "Joining date cannot be in the future"},
        )
    age_at_joining = (body.date_of_joining - body.date_of_birth).days // 365
    if age_at_joining < 18:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_EMP_INVALID_JOINING", "message": "Must be at least 18 at joining"},
        )

    if body.prior_experience_years > 40:
        _ = True

    await set_audit_change_remarks(db, f"employee_create:{body.employee_code}")

    now = datetime.now(timezone.utc)
    uid = UUID(current_user.user_id)
    emp = Employee(
        **body.model_dump(),
        created_by=current_user.full_name,
        created_at=now,
        uploaded_by_user_id=uid,
        owner_role=current_user.role,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp


async def _check_edit_permission(
    db: AsyncSession,
    employee: Employee,
    current_user: User,
    *,
    allow_employee: bool = True,
) -> None:
    """Raises 403 if current_user cannot edit (or deactivate) this employee record."""
    role = current_user.role

    if role == "ROLE_ADMIN":
        return

    if role == "ROLE_DEPT_OFFICER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ERR_EMP_OWNERSHIP_DENIED",
                "message": "Department Officers cannot edit employee records",
            },
        )

    if role == "ROLE_MANAGER":
        scope = await get_manager_scope(db, current_user.user_id)
        in_scope = bool(scope) and any(
            s["location"] == employee.service_province and s["department_name"] == employee.department_name
            for s in scope
        )
        if not in_scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_EMP_OWNERSHIP_DENIED",
                    "message": "Employee is not within your assigned scope",
                },
            )
        own_upload = (
            employee.uploaded_by_user_id is not None
            and str(employee.uploaded_by_user_id) == str(current_user.user_id)
        )
        not_manager_owned = (employee.owner_role or "") != "ROLE_MANAGER"
        if not (own_upload or not_manager_owned):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_EMP_OWNERSHIP_DENIED",
                    "message": "This employee record was created by another manager",
                },
            )
        return

    if role == "ROLE_EMPLOYEE":
        if not allow_employee:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_EMP_OWNERSHIP_DENIED",
                    "message": "Not authorized to deactivate employee records",
                },
            )
        own_upload = (
            employee.uploaded_by_user_id is not None
            and str(employee.uploaded_by_user_id) == str(current_user.user_id)
        )
        if own_upload:
            return
        uid = UUID(current_user.user_id)
        user_row = await db.scalar(select(AppUser).where(AppUser.user_id == uid))
        email_match = (
            user_row is not None
            and (employee.email or "").lower() == (user_row.email or "").lower()
        )
        if not email_match:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ERR_EMP_OWNERSHIP_DENIED",
                    "message": "You can only edit your own employee record",
                },
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "ERR_EMP_OWNERSHIP_DENIED",
            "message": "Not authorized to edit employee records",
        },
    )


async def update_employee(
    db: AsyncSession,
    code: str,
    body: EmployeeUpdate,
    current_user: User,
) -> Employee:
    emp = await get_employee(db, code, current_user)
    await _check_edit_permission(db, emp, current_user)

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return emp

    if current_user.role == "ROLE_MANAGER":
        scope = await get_manager_scope(db, current_user.user_id)
        if "service_province" in updates or "department_name" in updates:
            sp = updates.get("service_province", emp.service_province)
            dn = updates.get("department_name", emp.department_name)
            if scope and not any(sp == s["location"] and dn == s["department_name"] for s in scope):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "code": "ERR_AUTH_MINISTRY_SCOPE",
                        "message": "Cannot move employee outside your scope",
                    },
                )

    if "email" in updates:
        await _check_duplicate(db, "email", updates["email"], "ERR_EMP_EMAIL_DUPLICATE", exclude_code=code)
    if "civil_service_card_id" in updates:
        await _check_duplicate(
            db,
            "civil_service_card_id",
            updates["civil_service_card_id"],
            "ERR_EMP_CSC_DUPLICATE",
            exclude_code=code,
        )
    if "bank_account_no" in updates:
        await _check_duplicate(
            db,
            "bank_account_no",
            updates["bank_account_no"],
            "ERR_EMP_BANK_ACCT_DUPLICATE",
            exclude_code=code,
        )

    await set_audit_change_remarks(db, f"employee_update:{code}")

    now = datetime.now(timezone.utc)
    await db.execute(
        update(Employee)
        .where(Employee.employee_code == code)
        .values(**updates, updated_by=current_user.full_name, updated_at=now),
    )
    await db.commit()
    return await get_employee(db, code, current_user)


def _validation_errors_from_pydantic(exc: ValidationError) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for err in exc.errors():
        loc = err.get("loc") or ()
        field = str(loc[-1]) if loc else "body"
        msg = err.get("msg", "Invalid")
        out.append({"field": field, "message": msg})
    return out


async def create_employees_batch(
    db: AsyncSession,
    current_user: User,
    raw_rows: list[dict],
) -> dict:
    """Insert up to 200 employees; invalid rows skipped; one transaction for all valid rows."""
    if len(raw_rows) > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ERR_BATCH_TOO_LARGE", "message": "Maximum 200 rows per batch"},
        )

    if current_user.role == "ROLE_DEPT_OFFICER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ERR_EMP_OWNERSHIP_DENIED", "message": "Department officers cannot create employees"},
        )

    results: list[dict] = []
    seen_code: set[str] = set()
    seen_email: set[str] = set()
    seen_csc: set[str] = set()
    seen_bank: set[str] = set()
    seen_sso: set[str] = set()

    to_insert: list[tuple[int, EmployeeCreate]] = []

    first_free = await _next_employee_code(db)
    alloc_next = int(first_free[3:])

    for row_index, raw in enumerate(raw_rows):
        try:
            body = EmployeeCreate.model_validate(raw)
        except ValidationError as ve:
            results.append(
                {
                    "row": row_index,
                    "status": "error",
                    "errors": _validation_errors_from_pydantic(ve),
                },
            )
            continue

        if body.employee_code is None or not str(body.employee_code).strip():
            code = f"LAO{alloc_next:05d}"
            alloc_next += 1
            body = body.model_copy(update={"employee_code": code})
        else:
            ec = str(body.employee_code).strip()
            try:
                n = int(ec[3:])
            except ValueError:
                results.append(
                    {
                        "row": row_index,
                        "status": "error",
                        "errors": [{"field": "employee_code", "message": "Invalid employee code"}],
                    },
                )
                continue
            alloc_next = max(alloc_next, n + 1)

        row_errors: list[dict[str, str]] = []

        if current_user.role == "ROLE_MANAGER":
            scope = await get_manager_scope(db, current_user.user_id)
            if not scope:
                row_errors.append(
                    {"field": "department_name", "message": "No scope assigned to this manager"},
                )
            elif not any(
                body.service_province == s["location"] and body.department_name == s["department_name"]
                for s in scope
            ):
                row_errors.append(
                    {
                        "field": "department_name",
                        "message": "Cannot create employee outside your location/department scope",
                    },
                )

        if body.employee_code in seen_code:
            row_errors.append({"field": "employee_code", "message": "Duplicate employee code in batch"})
        if body.email.lower() in seen_email:
            row_errors.append({"field": "email", "message": "Duplicate email in batch"})
        if body.civil_service_card_id in seen_csc:
            row_errors.append({"field": "civil_service_card_id", "message": "Duplicate civil service card in batch"})
        if body.bank_account_no in seen_bank:
            row_errors.append({"field": "bank_account_no", "message": "Duplicate bank account in batch"})
        sso_key = str(body.sso_number).strip() if body.sso_number else ""
        if sso_key and sso_key in seen_sso:
            row_errors.append({"field": "sso_number", "message": "Duplicate SSO number in batch"})

        if row_errors:
            results.append({"row": row_index, "status": "error", "errors": row_errors})
            continue

        dup = await dup_svc.check_duplicate(db, "email", body.email)
        if dup["is_duplicate"]:
            row_errors.append(
                {
                    "field": "email",
                    "message": f"Duplicate email (existing {dup['existing_code']})",
                },
            )
        dup = await dup_svc.check_duplicate(db, "civil_service_card_id", body.civil_service_card_id)
        if dup["is_duplicate"]:
            row_errors.append(
                {
                    "field": "civil_service_card_id",
                    "message": f"Duplicate civil service card (existing {dup['existing_code']})",
                },
            )
        dup = await dup_svc.check_duplicate(db, "bank_account_no", body.bank_account_no)
        if dup["is_duplicate"]:
            row_errors.append(
                {
                    "field": "bank_account_no",
                    "message": f"Duplicate bank account (existing {dup['existing_code']})",
                },
            )
        dup = await dup_svc.check_duplicate(db, "employee_code", body.employee_code)
        if dup["is_duplicate"]:
            row_errors.append(
                {
                    "field": "employee_code",
                    "message": f"Duplicate employee code (existing {dup['existing_code']})",
                },
            )
        if sso_key:
            dup = await dup_svc.check_duplicate(db, "sso_number", sso_key)
            if dup["is_duplicate"]:
                row_errors.append(
                    {
                        "field": "sso_number",
                        "message": f"Duplicate SSO number (existing {dup['existing_code']})",
                    },
                )

        if row_errors:
            results.append({"row": row_index, "status": "error", "errors": row_errors})
            continue

        today = date.today()
        age = (today - body.date_of_birth).days // 365
        if age < 18 or age > 65:
            results.append(
                {
                    "row": row_index,
                    "status": "error",
                    "errors": [{"field": "date_of_birth", "message": "Invalid date of birth"}],
                },
            )
            continue
        if body.date_of_joining > today:
            results.append(
                {
                    "row": row_index,
                    "status": "error",
                    "errors": [{"field": "date_of_joining", "message": "Joining date cannot be in the future"}],
                },
            )
            continue
        age_at_joining = (body.date_of_joining - body.date_of_birth).days // 365
        if age_at_joining < 18:
            results.append(
                {
                    "row": row_index,
                    "status": "error",
                    "errors": [{"field": "date_of_joining", "message": "Must be at least 18 at joining"}],
                },
            )
            continue

        seen_code.add(body.employee_code)
        seen_email.add(body.email.lower())
        seen_csc.add(body.civil_service_card_id)
        seen_bank.add(body.bank_account_no)
        if sso_key:
            seen_sso.add(sso_key)

        to_insert.append((row_index, body))

    await set_audit_change_remarks(db, "employee_batch_import")

    now = datetime.now(timezone.utc)
    uid = UUID(current_user.user_id)

    for row_index, body in to_insert:
        emp = Employee(
            **body.model_dump(),
            created_by=current_user.full_name,
            created_at=now,
            uploaded_by_user_id=uid,
            owner_role=current_user.role,
        )
        db.add(emp)
        results.append(
            {
                "row": row_index,
                "status": "success",
                "employee_code": body.employee_code,
            },
        )

    await db.commit()

    results.sort(key=lambda r: int(r["row"]))
    imported = sum(1 for r in results if r.get("status") == "success")
    skipped = sum(1 for r in results if r.get("status") == "error")

    return {"imported": imported, "skipped": skipped, "results": results}


async def deactivate_employee(db: AsyncSession, code: str, current_user: User) -> Employee:
    emp = await get_employee(db, code, current_user)
    await _check_edit_permission(db, emp, current_user, allow_employee=False)
    if not emp.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "ERR_EMP_NOT_FOUND",
                "message": "Employee is already inactive",
            },
        )
    await set_audit_change_remarks(db, f"employee_deactivate:{code}")

    now = datetime.now(timezone.utc)
    await db.execute(
        update(Employee)
        .where(Employee.employee_code == code)
        .values(is_active=False, updated_by=current_user.full_name, updated_at=now),
    )
    await db.commit()
    return await get_employee(db, code, current_user)
