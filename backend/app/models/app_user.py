"""Application user: credentials hash, role, preferred language, lock state."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppUser(Base):
    __tablename__ = "app_user"
    __table_args__ = (
        CheckConstraint(
            "role IN ('ROLE_EMPLOYEE','ROLE_MANAGER','ROLE_DEPT_OFFICER','ROLE_ADMIN')",
            name="app_user_role_check",
        ),
        CheckConstraint("preferred_language IN ('en', 'lo')", name="ck_app_user_lang"),
        CheckConstraint(
            "registration_status IN ('PENDING','ACTIVE','REJECTED')",
            name="app_user_registration_status_check",
        ),
    )

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    ministry_scope: Mapped[str | None] = mapped_column(String(80))
    preferred_language: Mapped[str] = mapped_column(String(2), nullable=False, default="en")
    registration_status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    force_password_change: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    failed_login_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
