"""Async payroll run via Celery (POST /payroll/run)."""

from __future__ import annotations

import asyncio
import traceback
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text

from app.celery_app import celery_app
from app.database import SyncSessionLocal
from app.models.celery_task_result import CeleryTaskResult
from app.schemas.auth import User
from app.schemas.payroll import PayrollRunRequest
from app.services import payroll_service

TASK_NAME = "app.tasks.payroll_tasks.run_payroll_job"


def _persist_job(
    task_id: str,
    *,
    status: str,
    result: dict | None = None,
    traceback_text: str | None = None,
) -> None:
    now = datetime.now(timezone.utc)
    with SyncSessionLocal() as db:
        row = db.get(CeleryTaskResult, task_id)
        if row is None:
            db.add(
                CeleryTaskResult(
                    task_id=task_id,
                    task_name=TASK_NAME,
                    status=status,
                    result=result,
                    traceback=traceback_text,
                    date_done=None if status == "RUNNING" else now,
                )
            )
        else:
            row.task_name = TASK_NAME
            row.status = status
            row.result = result
            row.traceback = traceback_text
            row.date_done = None if status == "RUNNING" else now
        db.commit()


async def _run_payroll_async(
    month: str,
    ministry_filter: str | None,
    user_payload: dict,
) -> dict:
    from sqlalchemy.ext.asyncio import (
        AsyncSession,
        async_sessionmaker,
        create_async_engine,
    )
    from app.config import get_settings

    settings = get_settings()

    # Create a fresh engine per task — required because asyncpg
    # connections are not fork-safe. The module-level engine in
    # database.py is inherited by prefork child processes and
    # causes "another operation is in progress" when shared.
    task_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=2,
        max_overflow=2,
    )
    task_session_maker = async_sessionmaker(
        task_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    try:
        user = User.model_validate(user_payload)
        request = PayrollRunRequest(month=month, ministry_filter=ministry_filter)

        async with task_session_maker() as db:
            await db.execute(
                text("SELECT set_config('app.ifms_role', :role, true)"),
                {"role": user.role},
            )
            await db.execute(
                text("SELECT set_config('app.current_ministry', :ministry, true)"),
                {"ministry": ""},
            )
            audit_id = (
                (user.full_name or user.user_id or "").strip() or "unknown"
            )
            await db.execute(
                text("SELECT set_config('app.audit_user', :u, true)"),
                {"u": audit_id},
            )
            return await payroll_service.run_payroll_month(db, request, user)
    finally:
        await task_engine.dispose()


@celery_app.task(bind=True, name=TASK_NAME)
def run_payroll_job(
    self,
    *,
    month: str,
    ministry_filter: str | None,
    user_payload: dict,
) -> dict:
    task_id = self.request.id
    if not task_id:
        raise RuntimeError("Celery task id missing")

    _persist_job(task_id, status="RUNNING")
    try:
        out = asyncio.run(_run_payroll_async(month, ministry_filter, user_payload))
        _persist_job(task_id, status="SUCCESS", result=out)
        return out
    except HTTPException as e:
        err = e.detail if isinstance(e.detail, dict) else {"message": str(e.detail)}
        _persist_job(
            task_id,
            status="FAILURE",
            result={"error": err},
            traceback_text=traceback.format_exc(),
        )
        raise
    except Exception:
        _persist_job(task_id, status="FAILURE", traceback_text=traceback.format_exc())
        raise
