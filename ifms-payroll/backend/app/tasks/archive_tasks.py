"""Scheduled Celery tasks for payroll archival (retention policy)."""

from app.celery_app import celery_app


@celery_app.task(name="app.tasks.archive_tasks.archive_old_payroll")
def archive_old_payroll() -> None:
    """TODO: Section 14 — scheduled archival (beat 1st of month 02:00 Asia/Vientiane)."""
    return None
