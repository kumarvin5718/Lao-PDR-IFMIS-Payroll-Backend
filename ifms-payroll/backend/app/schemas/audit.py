"""Audit trail row shapes returned to the UI."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogRow(BaseModel):
    id: int
    table_name: str
    row_key: str
    field_name: str
    old_value: str | None = None
    new_value: str | None = None
    changed_by: str
    changed_at: datetime
    circular_ref: str | None = None
    change_remarks: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogQuery(BaseModel):
    """Query params for GET /api/v1/reports/audit-log."""

    table: str | None = None  # exact match on table_name
    from_date: str | None = None  # ISO date YYYY-MM-DD, maps to ?from=
    to_date: str | None = None  # ISO date YYYY-MM-DD, maps to ?to=
    changed_by: str | None = None  # ILIKE substring
    circular_ref: str | None = None
    page: int = 1
    limit: int = 100
    export: str | None = None  # 'xlsx' triggers async Celery job
