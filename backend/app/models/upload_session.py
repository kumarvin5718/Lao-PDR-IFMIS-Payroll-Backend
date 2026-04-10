"""Bulk upload session and row-level validation state."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UploadSession(Base):
    __tablename__ = "upload_session"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    upload_type: Mapped[str] = mapped_column(String(30), nullable=False)
    uploaded_by: Mapped[str] = mapped_column(String(80), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    file_path: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    total_rows: Mapped[int | None] = mapped_column(Integer)
    valid_rows: Mapped[int | None] = mapped_column(Integer)
    warning_rows: Mapped[int | None] = mapped_column(Integer)
    error_rows: Mapped[int | None] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class UploadSessionRow(Base):
    __tablename__ = "upload_session_row"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("upload_session.session_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    employee_code: Mapped[str | None] = mapped_column(String(10))
    raw_data: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    errors: Mapped[str | None] = mapped_column(Text)
    warnings: Mapped[str | None] = mapped_column(Text)
