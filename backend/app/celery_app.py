from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ifms_payroll",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.payroll_tasks",
        "app.tasks.upload_tasks",
        "app.tasks.report_tasks",
        "app.tasks.reports",
        "app.tasks.archive_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Vientiane",
    enable_utc=False,
    beat_schedule={
        "archive-old-payroll": {
            "task": "app.tasks.archive_tasks.archive_old_payroll",
            "schedule": crontab(hour=2, minute=0, day_of_month=1),
        },
    },
)

# Eagerly import task modules so @celery_app.task decorators run as soon as this app loads.
# Without this, workers can miss tasks (NotRegistered: 'app.tasks.reports.export_employees_task')
# if loader.import_default_modules() ordering differs by Celery version or entrypoint.
import importlib

for _task_mod in (
    "app.tasks.payroll_tasks",
    "app.tasks.upload_tasks",
    "app.tasks.report_tasks",
    "app.tasks.reports",
    "app.tasks.archive_tasks",
):
    importlib.import_module(_task_mod)
