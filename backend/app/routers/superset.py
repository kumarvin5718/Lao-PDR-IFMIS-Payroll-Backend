import httpx
from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.dependencies import AuthUser
from app.utils.valkey import valkey_client

router = APIRouter(prefix="/superset", tags=["superset"])

ADMIN_TOKEN_KEY = "superset:admin_token"


def _ok(data: object) -> dict:
    return {"success": True, "data": data, "pagination": None, "error": None}


async def _get_superset_admin_token() -> str:
    """Fetch and cache Superset admin JWT in Valkey (TTL 50 min)."""
    cached = await valkey_client.get(ADMIN_TOKEN_KEY)
    if cached:
        return cached

    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{settings.SUPERSET_URL.rstrip('/')}/api/v1/security/login",
                json={
                    "username": settings.SUPERSET_ADMIN_USER,
                    "password": settings.SUPERSET_ADMIN_PASS,
                    "provider": "db",
                    "refresh": True,
                },
            )
            r.raise_for_status()
            body = r.json()
            token = body.get("access_token")
            if not token:
                raise HTTPException(
                    status_code=502,
                    detail="Superset login did not return access_token",
                )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Superset login failed: {exc!s}",
        ) from exc

    await valkey_client.set(ADMIN_TOKEN_KEY, token, ex=3000)  # 50 min
    return token


@router.get("/guest-token")
async def get_guest_token(
    current_user: AuthUser,
    dashboard_id: str = Query(..., description="Superset dashboard UUID or id"),
) -> dict:
    admin_token = await _get_superset_admin_token()

    # RLS clauses for guest token — scope is resolved in IFMS / future slices; JWT no longer carries ministry.
    rls: list[dict[str, str]] = []

    settings = get_settings()
    payload = {
        "user": {
            "username": str(current_user.user_id),
            "first_name": current_user.full_name,
            "last_name": "",
        },
        "resources": [{"type": "dashboard", "id": dashboard_id}],
        "rls": rls,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{settings.SUPERSET_URL.rstrip('/')}/api/v1/security/guest_token/",
                headers={"Authorization": f"Bearer {admin_token}"},
                json=payload,
            )
            r.raise_for_status()
            body = r.json()
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Superset guest_token failed: {exc!s}",
        ) from exc

    token = body.get("token")
    if not token:
        raise HTTPException(
            status_code=502,
            detail="Superset guest_token response missing token",
        )
    return _ok({"token": token})
