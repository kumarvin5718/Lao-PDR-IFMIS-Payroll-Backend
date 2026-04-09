"""Ministry master CRUD."""

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import AuthUser, ROLE_ADMIN_ONLY
from app.schemas.ministry import MinistryCreate, MinistryOut, MinistryUpdate
from app.services import ministry_service as svc

router = APIRouter(tags=["ministry-master"])


def _ok(data: object) -> dict:
    return {"success": True, "data": data, "pagination": None, "error": None}


def _row_out(row: object) -> dict:
    return MinistryOut.model_validate(svc.ministry_to_dict(row)).model_dump(mode="json")


@router.get("/ministry")
async def get_ministry_master_list(
    _user: AuthUser,
    db: AsyncSession = Depends(get_db),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
) -> dict:
    result = await svc.list_ministries_paginated(db, search=search, page=page, size=size)
    return _ok(
        {
            "items": [_row_out(r) for r in result["items"]],
            "total": result["total"],
            "page": result["page"],
            "size": result["size"],
            "pages": result["pages"],
        }
    )


@router.post("/ministry", status_code=status.HTTP_201_CREATED)
async def post_ministry_master(
    _admin: ROLE_ADMIN_ONLY,
    body: MinistryCreate,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    row = await svc.create_ministry(db, body)
    return JSONResponse(status_code=201, content=_ok(_row_out(row)))


@router.put("/ministry/{ministry_key}")
async def put_ministry_master(
    _admin: ROLE_ADMIN_ONLY,
    ministry_key: str,
    body: MinistryUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = await svc.update_ministry(db, ministry_key, body)
    return _ok(_row_out(row))


@router.delete("/ministry/{ministry_key}")
async def delete_ministry_master(
    _admin: ROLE_ADMIN_ONLY,
    ministry_key: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    await svc.delete_ministry(db, ministry_key)
    return {"detail": "deleted"}
