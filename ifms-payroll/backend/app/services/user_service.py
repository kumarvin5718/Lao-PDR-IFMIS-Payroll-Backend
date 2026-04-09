"""Admin user provisioning, password reset tokens, and profile updates."""

import secrets
import string
from uuid import UUID

from fastapi import status
from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import AppError
from app.models.app_user import AppUser
from app.schemas.user import UserCreate, UserListItem, UserOut, UserUpdate

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

TEMP_PWD_CHARS = string.ascii_letters + string.digits + "!@#$%^&*"


def _gen_temp_password(length: int = 12) -> str:
    if length < 4:
        length = 4
    required = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*"),
    ]
    rest = [secrets.choice(TEMP_PWD_CHARS) for _ in range(length - 4)]
    chars = required + rest
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


async def list_users(db: AsyncSession, page: int, limit: int) -> tuple[list[AppUser], int]:
    count_stmt = select(func.count()).select_from(AppUser)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = (
        select(AppUser)
        .order_by(AppUser.username.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    return rows, total


async def create_user(db: AsyncSession, payload: UserCreate) -> tuple[AppUser, str]:
    dup_user = await db.scalar(select(AppUser).where(AppUser.username == payload.username))
    if dup_user is not None:
        raise AppError(
            "ERR_USER_USERNAME_DUPLICATE",
            "Username already exists",
            status_code=status.HTTP_409_CONFLICT,
        )

    dup_email = await db.scalar(select(AppUser).where(AppUser.email == str(payload.email)))
    if dup_email is not None:
        raise AppError(
            "ERR_USER_EMAIL_DUPLICATE",
            "Email already exists",
            status_code=status.HTTP_409_CONFLICT,
        )

    plain = _gen_temp_password()
    user = AppUser(
        username=payload.username,
        full_name=payload.full_name,
        email=str(payload.email),
        password_hash=pwd_ctx.hash(plain),
        role=payload.role,
        preferred_language=payload.preferred_language,
        is_active=True,
        force_password_change=True,
        failed_login_count=0,
        locked_until=None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user, plain


def user_to_list_item(user: AppUser) -> UserListItem:
    return UserListItem(
        user_id=str(user.user_id),
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        preferred_language=user.preferred_language,
        is_active=user.is_active,
        last_login=user.last_login,
    )


def user_to_out(user: AppUser) -> UserOut:
    return UserOut(
        user_id=str(user.user_id),
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        preferred_language=user.preferred_language,
        is_active=user.is_active,
        force_password_change=user.force_password_change,
        last_login=user.last_login,
    )


async def update_user(db: AsyncSession, user_id: str, payload: UserUpdate) -> AppUser:
    try:
        uid = UUID(user_id)
    except ValueError as exc:
        raise AppError(
            "ERR_USER_NOT_FOUND",
            "Invalid user id",
            status_code=status.HTTP_404_NOT_FOUND,
        ) from exc

    user = await db.get(AppUser, uid)
    if user is None:
        raise AppError(
            "ERR_USER_NOT_FOUND",
            "User not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.preferred_language is not None:
        user.preferred_language = payload.preferred_language

    await db.commit()
    await db.refresh(user)
    return user


async def reset_password(db: AsyncSession, user_id: str) -> str:
    try:
        uid = UUID(user_id)
    except ValueError as exc:
        raise AppError(
            "ERR_USER_NOT_FOUND",
            "Invalid user id",
            status_code=status.HTTP_404_NOT_FOUND,
        ) from exc

    user = await db.get(AppUser, uid)
    if user is None:
        raise AppError(
            "ERR_USER_NOT_FOUND",
            "User not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    plain = _gen_temp_password()
    user.password_hash = pwd_ctx.hash(plain)
    user.force_password_change = True
    user.failed_login_count = 0
    user.locked_until = None
    await db.commit()
    await db.refresh(user)
    return plain
