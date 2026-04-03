from app.celery_app import celery_app


@celery_app.task(name="app.tasks.payroll_tasks.run_payroll_job")
def run_payroll_job() -> None:
    """TODO: async payroll run (Section 12 POST /payroll/run)."""
    return None


@celery_app.task(name="app.tasks.payroll_tasks.poll_payroll_status")
def poll_payroll_status() -> None:
    """TODO: optional helper for job polling."""
    return None
