import logging
import time
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from passlib.context import CryptContext
from sqlalchemy import select, update
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.app_login_history import AppLoginHistory
from app.models.app_user import AppUser
from app.schemas.auth import TokenPair

logger = logging.getLogger("ifms.auth")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _settings():
    return get_settings()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception as exc:
        # Malformed hash or passlib/bcrypt edge cases — treat as failed login, not 500.
        logger.warning("password verify error (treating as invalid): %s", exc)
        return False


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def _create_token(data: dict, expires_delta: timedelta) -> str:
    settings = _settings()
    to_encode = data.copy()
    now_iat = int(time.time())
    if "iat" not in to_encode:
        to_encode["iat"] = now_iat
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def _access_expire_minutes() -> int:
    return getattr(_settings(), "ACCESS_TOKEN_EXPIRE_MINUTES", 30)


def _refresh_expire_days() -> int:
    return getattr(_settings(), "REFRESH_TOKEN_EXPIRE_DAYS", 7)


def issue_token_pair(user: AppUser) -> TokenPair:
    access_payload = {
        "sub": str(user.user_id),
        "full_name": user.full_name,
        "role": user.role,
        "preferred_language": user.preferred_language,
        "email": user.email,
        "type": "access",
    }
    refresh_payload = {"sub": str(user.user_id), "type": "refresh"}
    access_token = _create_token(
        access_payload,
        timedelta(minutes=_access_expire_minutes()),
    )
    refresh_token = _create_token(
        refresh_payload,
        timedelta(days=_refresh_expire_days()),
    )
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        force_password_change=user.force_password_change,
    )


async def authenticate_user(
    db: AsyncSession,
    username: str,
    password: str,
    *,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AppUser:
    result = await db.execute(
        select(AppUser).where(
            AppUser.username == username,
            AppUser.is_active.is_(True),
        ),
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_INVALID_CREDENTIALS",
                "message": "Invalid username or password",
            },
        )

    now = datetime.now(timezone.utc)
    lu = user.locked_until
    if lu is not None and lu.tzinfo is None:
        lu = lu.replace(tzinfo=timezone.utc)
    if lu is not None and lu > now:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ERR_AUTH_ACCOUNT_LOCKED",
                "message": f"Account locked until {lu.isoformat()}",
                "locked_until": lu.isoformat(),
            },
        )

    if not verify_password(password, user.password_hash):
        new_count = user.failed_login_count + 1
        locked_until_val = None
        if new_count >= 5:
            locked_until_val = now + timedelta(minutes=15)
        await db.execute(
            update(AppUser)
            .where(AppUser.user_id == user.user_id)
            .values(
                failed_login_count=new_count,
                locked_until=locked_until_val,
            ),
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_INVALID_CREDENTIALS",
                "message": "Invalid username or password",
            },
        )

    success_updates = dict(
        failed_login_count=0,
        locked_until=None,
        last_login=now,
    )

    await db.execute(
        update(AppUser)
        .where(AppUser.user_id == user.user_id)
        .values(**success_updates),
    )
    db.add(
        AppLoginHistory(
            user_id=user.user_id,
            ip_address=ip_address,
            user_agent=(user_agent[:8000] if user_agent else None),
        ),
    )
    try:
        await db.commit()
    except ProgrammingError as exc:
        # Older DB volumes may lack app_login_history (init scripts ran before it existed).
        combined = f"{exc} {getattr(exc, 'orig', '')}"
        if "app_login_history" not in combined:
            raise
        await db.rollback()
        logger.warning(
            "app_login_history table missing; login proceeds without audit row. "
            "Apply db/patches/001_app_login_history.sql (or recreate DB with current db/init).",
        )
        await db.execute(
            update(AppUser)
            .where(AppUser.user_id == user.user_id)
            .values(**success_updates),
        )
        await db.commit()

    result2 = await db.execute(select(AppUser).where(AppUser.user_id == user.user_id))
    refreshed = result2.scalar_one()
    return refreshed


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> TokenPair:
    settings = _settings()
    try:
        payload = jwt.decode(
            refresh_token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
    except (ExpiredSignatureError, JWTError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_TOKEN_EXPIRED",
                "message": "Token expired or invalid",
            },
        ) from None

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_TOKEN_EXPIRED",
                "message": "Token expired or invalid",
            },
        )

    try:
        uid = UUID(str(payload["sub"]))
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_TOKEN_EXPIRED",
                "message": "Token expired or invalid",
            },
        )

    result = await db.execute(
        select(AppUser).where(AppUser.user_id == uid, AppUser.is_active.is_(True)),
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_TOKEN_EXPIRED",
                "message": "Token expired or invalid",
            },
        )

    return issue_token_pair(user)


async def change_password(
    db: AsyncSession,
    user_id: UUID,
    old_password: str,
    new_password: str,
) -> None:
    result = await db.execute(select(AppUser).where(AppUser.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_INVALID_CREDENTIALS",
                "message": "User not found",
            },
        )

    if not verify_password(old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_INVALID_CREDENTIALS",
                "message": "Invalid username or password",
            },
        )

    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ERR_VALIDATION",
                "message": "Password must be at least 8 characters",
                "field": "new_password",
            },
        )

    await db.execute(
        update(AppUser)
        .where(AppUser.user_id == user_id)
        .values(
            password_hash=hash_password(new_password),
            force_password_change=False,
        ),
    )
    await db.commit()
