"""CRUD and list for lk_ministry_master."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lk_ministry_master import LkMinistryMaster
from app.models.lk_org_master import LkOrgMaster
from app.schemas.ministry import MinistryCreate, MinistryUpdate


def ministry_to_dict(row: LkMinistryMaster) -> dict:
    return {
        "ministry_key": row.ministry_key,
        "ministry_name": row.ministry_name,
        "profession_category": row.profession_category,
        "na_allowance_eligible": row.na_allowance_eligible,
        "field_allowance_type": row.field_allowance_type,
        "effective_from": row.effective_from,
        "circular_ref": row.circular_ref,
    }


async def list_ministries_paginated(
    db: AsyncSession,
    *,
    search: str | None,
    page: int,
    size: int,
) -> dict:
    clause = None
    if search and search.strip():
        term = f"%{search.strip()}%"
        clause = or_(
            LkMinistryMaster.ministry_name.ilike(term),
            LkMinistryMaster.profession_category.ilike(term),
            LkMinistryMaster.ministry_key.ilike(term),
        )
    count_stmt = select(func.count()).select_from(LkMinistryMaster)
    if clause is not None:
        count_stmt = count_stmt.where(clause)
    total = int(await db.scalar(count_stmt) or 0)

    stmt = select(LkMinistryMaster).order_by(LkMinistryMaster.ministry_name.asc())
    if clause is not None:
        stmt = stmt.where(clause)
    stmt = stmt.offset((page - 1) * size).limit(size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())
    pages = (total + size - 1) // size if size > 0 else 0
    return {"items": items, "total": total, "page": page, "size": size, "pages": pages}


async def create_ministry(db: AsyncSession, body: MinistryCreate) -> LkMinistryMaster:
    key = body.ministry_key.strip()
    existing = await db.scalar(select(LkMinistryMaster).where(LkMinistryMaster.ministry_key == key))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "ERR_MINISTRY_DUPLICATE", "message": "Ministry key already exists"},
        )
    row = LkMinistryMaster(
        ministry_key=key,
        ministry_name=body.ministry_name.strip(),
        profession_category=body.profession_category.strip() if body.profession_category else None,
        na_allowance_eligible=body.na_allowance_eligible,
        field_allowance_type=body.field_allowance_type,
        effective_from=body.effective_from,
        effective_to=None,
        circular_ref=body.circular_ref,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def update_ministry(db: AsyncSession, ministry_key: str, body: MinistryUpdate) -> LkMinistryMaster:
    row = await db.scalar(select(LkMinistryMaster).where(LkMinistryMaster.ministry_key == ministry_key))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_NOT_FOUND", "message": "Ministry not found"},
        )
    patch = body.model_dump(exclude_unset=True)
    if "ministry_name" in patch and patch["ministry_name"] is not None:
        patch["ministry_name"] = patch["ministry_name"].strip()
    if "profession_category" in patch:
        pc = patch["profession_category"]
        patch["profession_category"] = (pc.strip() if isinstance(pc, str) else None) or None
    for k, v in patch.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


async def delete_ministry(db: AsyncSession, ministry_key: str) -> None:
    row = await db.scalar(select(LkMinistryMaster).where(LkMinistryMaster.ministry_key == ministry_key))
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ERR_NOT_FOUND", "message": "Ministry not found"},
        )
    in_use = await db.scalar(
        select(func.count()).select_from(LkOrgMaster).where(LkOrgMaster.ministry_key == ministry_key),
    )
    if in_use and int(in_use) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ministry in use by org master — remove departments first",
        )
    await db.execute(delete(LkMinistryMaster).where(LkMinistryMaster.ministry_key == ministry_key))
    await db.commit()
