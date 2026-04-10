"""JWT Bearer parsing, `get_current_user`, and role guard dependencies for routers."""

from typing import Annotated, Callable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError

from app.config import get_settings
from app.schemas.auth import User

settings = get_settings()
security = HTTPBearer(auto_error=False)


def _decode_token(token: str) -> User:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "ERR_AUTH_INVALID_TOKEN",
                    "message": "Invalid token",
                },
            )
        return User(
            user_id=str(payload.get("sub", "")),
            full_name=str(payload.get("full_name", "")),
            role=str(payload.get("role", "")),
            preferred_language=str(payload.get("preferred_language", "en")),
            email=str(payload.get("email", "")),
        )
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_TOKEN_EXPIRED",
                "message": "Token expired",
            },
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_INVALID_TOKEN",
                "message": "Invalid token",
            },
        ) from exc


async def get_optional_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
) -> Optional[User]:
    if credentials is None or not credentials.credentials:
        return None
    return _decode_token(credentials.credentials)


async def get_current_user(
    user: Annotated[Optional[User], Depends(get_optional_user)],
) -> User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "ERR_AUTH_TOKEN_EXPIRED",
                "message": "Not authenticated",
            },
        )
    return user


require_auth = get_current_user

AuthUser = Annotated[User, Depends(get_current_user)]


def require_role(roles: list[str]) -> Callable[..., User]:
    async def _dep(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ERR_AUTH_FORBIDDEN",
            )
        return user

    return _dep


ROLE_EMPLOYEE_MANAGER_ADMIN = Annotated[
    User,
    Depends(require_role(["ROLE_EMPLOYEE", "ROLE_MANAGER", "ROLE_ADMIN"])),
]
ROLE_HR_PLUS = ROLE_EMPLOYEE_MANAGER_ADMIN

ROLE_MANAGER_OR_ADMIN = Annotated[User, Depends(require_role(["ROLE_MANAGER", "ROLE_ADMIN"]))]
# Payroll run/patch/list + job status — same as manager/admin finance screens.
ROLE_FINANCE_PLUS = ROLE_MANAGER_OR_ADMIN

ROLE_ADMIN_ONLY = Annotated[User, Depends(require_role(["ROLE_ADMIN"]))]
# Audit log / export: same as payroll finance screens — ROLE_MANAGER + ROLE_ADMIN (no separate ROLE_FINANCE / ROLE_AUDITOR in schema).
ROLE_AUDIT_LOG_VIEW = ROLE_FINANCE_PLUS

ROLE_MASTER_ACCESS = Annotated[
    User,
    Depends(require_role(["ROLE_MANAGER", "ROLE_DEPT_OFFICER", "ROLE_ADMIN"])),
]

ROLE_ADMIN_OR_DEPT_OFFICER = Annotated[
    User,
    Depends(require_role(["ROLE_ADMIN", "ROLE_DEPT_OFFICER"])),
]

ROLE_MANAGER_ONLY = Annotated[
    User,
    Depends(require_role(["ROLE_MANAGER"])),
]
