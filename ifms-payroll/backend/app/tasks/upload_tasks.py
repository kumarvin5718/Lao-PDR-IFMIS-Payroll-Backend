"""Background processing for bulk employee uploads."""

from app.celery_app import celery_app


@celery_app.task(name="app.tasks.upload_tasks.process_bulk_upload")
def process_bulk_upload() -> None:
    """TODO: bulk upload processing."""
    return None
