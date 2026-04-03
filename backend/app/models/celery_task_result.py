from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CeleryTaskResult(Base):
    """Maps to `celery_task_result` per Section 11.3."""

    __tablename__ = "celery_task_result"

    task_id: Mapped[str] = mapped_column(String(155), primary_key=True)
    task_name: Mapped[str | None] = mapped_column(String(155))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")
    result: Mapped[dict | None] = mapped_column(JSONB)
    date_done: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    traceback: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
