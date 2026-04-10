"""Session GUCs consumed by PostgreSQL audit triggers (db/init/07_triggers.sql)."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

__all__ = ["set_audit_change_remarks"]


async def set_audit_change_remarks(db: AsyncSession, remarks: str) -> None:
    """Populate app.change_remarks for fn_audit_log / fn_audit_log_delete rows."""
    await db.execute(
        text("SELECT set_config('app.change_remarks', :r, true)"),
        {"r": remarks},
    )
