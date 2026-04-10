"""Report export tasks (audit log XLSX, etc.)."""

import os
import uuid
from datetime import date, datetime, timedelta, timezone

import openpyxl
from sqlalchemy import and_, select

from app.celery_app import celery_app
from app.config import get_settings
from app.database import SyncSessionLocal
from app.models.audit_log import AuditLog


def _parse_iso_date(value: str) -> date:
    return date.fromisoformat(value)


def _day_start_utc(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _build_audit_filters(
    table: str | None,
    from_date: str | None,
    to_date: str | None,
    changed_by: str | None,
    circular_ref: str | None,
) -> list:
    conds: list = []
    if table is not None:
        conds.append(AuditLog.table_name == table)
    if from_date is not None:
        d0 = _parse_iso_date(from_date)
        conds.append(AuditLog.changed_at >= _day_start_utc(d0))
    if to_date is not None:
        d1 = _parse_iso_date(to_date)
        conds.append(AuditLog.changed_at < _day_start_utc(d1 + timedelta(days=1)))
    if changed_by:
        conds.append(AuditLog.changed_by.ilike(f"%{changed_by}%"))
    if circular_ref:
        conds.append(AuditLog.circular_ref.ilike(f"%{circular_ref}%"))
    return conds


@celery_app.task(name="app.tasks.reports.export_audit_log_task")
def export_audit_log_task(
    table: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    changed_by: str | None = None,
    circular_ref: str | None = None,
    requested_by: str = "",
    user_id: str = "",
) -> dict:
    """Export audit_log rows to XLSX under REPORTS_DIR (max 50k rows)."""
    _ = requested_by  # reserved for workbook provenance / future use

    conds = _build_audit_filters(table, from_date, to_date, changed_by, circular_ref)
    stmt = select(AuditLog).order_by(AuditLog.changed_at.desc()).limit(50_000)
    if conds:
        stmt = stmt.where(and_(*conds))

    with SyncSessionLocal() as db:
        rows = db.execute(stmt).scalars().all()

    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Audit Log"
    headers = [
        "ID",
        "Table",
        "Row Key",
        "Field",
        "Old Value",
        "New Value",
        "Changed By",
        "Changed At",
        "Circular Ref",
        "Remarks",
    ]
    ws.append(headers)
    for r in rows:
        ws.append(
            [
                r.id,
                r.table_name,
                r.row_key,
                r.field_name,
                r.old_value,
                r.new_value,
                r.changed_by,
                r.changed_at.isoformat() if r.changed_at else "",
                r.circular_ref,
                r.change_remarks,
            ]
        )

    settings = get_settings()
    reports_dir = os.environ.get("REPORTS_DIR", settings.REPORTS_DIR)
    os.makedirs(reports_dir, exist_ok=True)
    filename = f"audit_log_{uuid.uuid4().hex[:8]}.xlsx"
    path = os.path.join(reports_dir, filename)
    wb.save(path)

    if user_id:
        from app.utils.report_download_registry import register_report_file_owner

        register_report_file_owner(filename, user_id)

    return {"file_path": path, "rows": len(rows)}


@celery_app.task(name="app.tasks.reports.export_employees_task")
def export_employees_task(filter_payload: dict, user_payload: dict) -> dict:
    """Async XLSX export when row count > 1000 (same columns as synchronous export)."""
    from app.database import SyncSessionLocal
    from app.schemas.auth import User
    from app.services.employee_export import export_employees_xlsx_sync

    user = User.model_validate(user_payload)
    settings = get_settings()
    reports_dir = os.environ.get("REPORTS_DIR", settings.REPORTS_DIR)
    with SyncSessionLocal() as db:
        out = export_employees_xlsx_sync(
            db,
            user,
            ministry=filter_payload.get("ministry"),
            grade=filter_payload.get("grade"),
            province=filter_payload.get("province"),
            employment_type=filter_payload.get("employment_type"),
            search=filter_payload.get("search"),
            is_active=filter_payload.get("is_active"),
            reports_dir=reports_dir,
        )
    from app.utils.report_download_registry import register_report_file_owner

    register_report_file_owner(os.path.basename(out["file_path"]), user.user_id)
    return out
