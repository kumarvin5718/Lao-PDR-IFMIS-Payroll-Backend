from app.celery_app import celery_app


@celery_app.task(name="app.tasks.report_tasks.generate_large_report")
def generate_large_report() -> None:
    """TODO: async report export > 5k rows."""
    return None
