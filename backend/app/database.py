from collections.abc import AsyncGenerator
from typing import Annotated, Optional

from fastapi import Depends
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings
from app.dependencies import get_optional_user
from app.schemas.auth import User

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for ORM models."""

    pass


async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class _SyncSessionFactory:
    """Lazy sync sessionmaker so FastAPI can load without psycopg2 (Celery workers install it)."""

    def __init__(self) -> None:
        self._maker: sessionmaker[Session] | None = None

    def __call__(self) -> Session:
        if self._maker is None:
            sync_engine = create_engine(
                settings.database_url_sync,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
            )
            self._maker = sessionmaker(
                bind=sync_engine,
                class_=Session,
                autocommit=False,
                autoflush=False,
            )
        return self._maker()


# Synchronous session for Celery workers (openpyxl / blocking DB access).
SyncSessionLocal = _SyncSessionFactory()


async def get_db(
    optional_user: Annotated[Optional[User], Depends(get_optional_user)],
) -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        if optional_user is not None:
            # Use set_config(..., true) for transaction-local settings: SET LOCAL does not accept
            # prepared $n placeholders with asyncpg. Avoid app.current_role — "current_role" is reserved.
            await session.execute(
                text("SELECT set_config('app.ifms_role', :role, true)"),
                {"role": optional_user.role},
            )
            await session.execute(
                text("SELECT set_config('app.current_ministry', :ministry, true)"),
                {"ministry": ""},
            )
            # Audit triggers (db/init/07_triggers.sql) read app.audit_user — not app.current_user
            # ("current_user" is reserved in PostgreSQL). Use set_config, not SET LOCAL, for asyncpg.
            audit_id = (optional_user.full_name or optional_user.user_id or "").strip() or "unknown"
            await session.execute(
                text("SELECT set_config('app.audit_user', :u, true)"),
                {"u": audit_id},
            )
        yield session
