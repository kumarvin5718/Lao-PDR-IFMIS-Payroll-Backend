from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import AuthUser
from app.models.app_user import AppUser
from app.schemas.auth import ChangePasswordRequest, LoginRequest, UserOut
from app.services.auth_service import (
    authenticate_user,
    change_password,
    issue_token_pair,
    refresh_access_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "refresh_token"
COOKIE_PATH = "/api/v1/auth/refresh"
COOKIE_MAX_AGE = 7 * 24 * 3600


def _envelope_ok(data: dict) -> dict:
    return {
        "success": True,
        "data": data,
        "pagination": None,
        "error": None,
    }


def _set_refresh_cookie(response: JSONResponse, refresh_token: str) -> None:
    secure = get_settings().COOKIE_SECURE
    response.set_cookie(
        key=COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        samesite="strict",
        secure=secure,
        max_age=COOKIE_MAX_AGE,
        path=COOKIE_PATH,
    )


def _clear_refresh_cookie(response: JSONResponse) -> None:
    secure = get_settings().COOKIE_SECURE
    response.delete_cookie(
        COOKIE_NAME,
        path=COOKIE_PATH,
        httponly=True,
        samesite="strict",
        secure=secure,
    )


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    if request.client:
        return request.client.host
    return None


@router.post("/login")
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    user = await authenticate_user(
        db,
        body.username,
        body.password,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    pair = issue_token_pair(user)
    user_out = UserOut(
        user_id=str(user.user_id),
        full_name=user.full_name,
        role=user.role,
        preferred_language=user.preferred_language,
        email=user.email,
    )
    payload = {
        "access_token": pair.access_token,
        "token_type": pair.token_type,
        "force_password_change": pair.force_password_change,
        "user": user_out.model_dump(),
    }
    response = JSONResponse(content=_envelope_ok(payload))
    _set_refresh_cookie(response, pair.refresh_token)
    return response


@router.post("/refresh")
async def refresh(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    cookie = request.cookies.get(COOKIE_NAME)
    if not cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_TOKEN_EXPIRED",
                "message": "Token expired or invalid",
            },
        )
    pair = await refresh_access_token(db, cookie)
    payload = {
        "access_token": pair.access_token,
        "token_type": pair.token_type,
        "force_password_change": pair.force_password_change,
    }
    response = JSONResponse(content=_envelope_ok(payload))
    _set_refresh_cookie(response, pair.refresh_token)
    return response


@router.post("/logout")
async def logout() -> JSONResponse:
    response = JSONResponse(
        content=_envelope_ok({"message": "Logged out"}),
    )
    _clear_refresh_cookie(response)
    return response


@router.post("/change-password")
async def change_password_route(
    body: ChangePasswordRequest,
    current_user: AuthUser,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await change_password(
        db,
        UUID(current_user.user_id),
        body.old_password,
        body.new_password,
    )
    return _envelope_ok({"message": "Password changed"})


@router.get("/me")
async def me(current_user: AuthUser, db: AsyncSession = Depends(get_db)) -> dict:
    row = await db.scalar(select(AppUser).where(AppUser.user_id == UUID(current_user.user_id)))
    email = (row.email if row else "") or current_user.email
    out = UserOut(
        user_id=current_user.user_id,
        full_name=current_user.full_name,
        role=current_user.role,
        preferred_language=current_user.preferred_language,
        email=email,
    )
    return _envelope_ok(out.model_dump())
