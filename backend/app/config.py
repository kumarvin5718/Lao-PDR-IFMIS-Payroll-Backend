"""Environment variables and Pydantic `Settings` for the API, Celery, Superset, and CORS."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = Field(
        ...,
        description="SQLAlchemy async URL, e.g. postgresql+asyncpg://user:pass@host:5432/db",
    )
    # Optional sync URL for Alembic (e.g. postgres superuser). Needed when init SQL owns tables
    # that payroll_app cannot ALTER (e.g. app_login_history index in migration 0002).
    ALEMBIC_DATABASE_URL: str | None = Field(
        default=None,
        description="Optional psycopg2 URL for alembic upgrade (defaults to DATABASE_URL sync)",
    )
    VALKEY_URL: str = Field(..., description="Redis/Valkey URL for cache and Celery broker compatibility")
    CELERY_BROKER_URL: str = Field(..., description="Celery broker (Valkey)")
    SECRET_KEY: str = Field(..., description="JWT signing secret")
    SUPERSET_URL: str = Field(
        default="http://superset:8088",
        description="Base URL for Apache Superset (internal Docker; API paths are on app root)",
    )
    SUPERSET_ADMIN_USER: str = Field(..., description="Superset admin username for guest-token API")
    SUPERSET_ADMIN_PASS: str = Field(..., description="Superset admin password for guest-token API")
    UPLOAD_DIR: str = "/app/uploads"
    REPORTS_DIR: str = "/app/reports"
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        description="Comma-separated list of allowed CORS origins",
    )
    # Refresh-token cookie: must be False when calling the API over plain HTTP (e.g. local Vite → http://api:8000).
    # Use True behind HTTPS (Docker nginx on :18443, production).
    COOKIE_SECURE: bool = Field(default=True, description="Set False for local HTTP API without TLS")
    # When True, 500 responses include the exception message (do not enable in production).
    APP_DEBUG: bool = Field(default=False)
    # When True, POST /payroll/run runs in-process (no Celery). Use when the worker is unavailable.
    PAYROLL_RUN_SYNC: bool = Field(default=False)

    @property
    def database_url_sync(self) -> str:
        """Sync SQLAlchemy/psycopg2 URL for Celery result backend."""
        return self.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg2")

    @property
    def alembic_database_url_sync(self) -> str:
        """Sync URL for Alembic CLI (optional superuser for migrations on init-owned tables)."""
        if self.ALEMBIC_DATABASE_URL:
            return self.ALEMBIC_DATABASE_URL
        return self.database_url_sync

    @property
    def celery_result_backend(self) -> str:
        """Celery database result backend (PostgreSQL via celery_taskmeta / SQLAlchemy)."""
        # Celery database backend expects db+postgresql+psycopg2://...
        sync = self.database_url_sync
        if sync.startswith("postgresql+psycopg2://"):
            return "db+" + sync
        return sync

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
