import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import ProgrammingError

from app.config import get_settings
from app.routers import (
    admin,
    archive,
    auth,
    bulk_upload,
    dashboard,
    employees,
    lookups,
    master,
    master_scope,
    payroll,
    registration,
    reports,
    superset,
    uploads,
)
from app.schemas.common import ErrorResponse, StandardResponse

settings = get_settings()
logger = logging.getLogger("ifms.api")


async def warm_valkey_lookup_cache() -> None:
    """Warm Valkey cache for all 7 lookup tables (Section 3.2 / main startup)."""
    _ = settings.VALKEY_URL


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await warm_valkey_lookup_cache()
    yield


app = FastAPI(
    title="IFMS Payroll API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(registration.router, prefix=API_PREFIX)
app.include_router(employees.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(uploads.router, prefix=API_PREFIX)
app.include_router(bulk_upload.router, prefix=API_PREFIX)
app.include_router(payroll.router, prefix=API_PREFIX)
app.include_router(lookups.router, prefix=API_PREFIX)
app.include_router(master.router, prefix=API_PREFIX)
app.include_router(master_scope.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(superset.router, prefix=API_PREFIX)
app.include_router(archive.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)


def _error_payload(code: str, message: str, field: str | None = None) -> dict:
    body = StandardResponse(
        success=False,
        data=None,
        pagination=None,
        error=ErrorResponse(code=code, message=message, field=field),
    )
    return body.model_dump()


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, str):
        code = detail
        message = detail
        field = None
    elif isinstance(detail, dict):
        code = str(detail.get("code", "ERR_INTERNAL"))
        message = str(detail.get("message", code))
        field = detail.get("field")
    else:
        code = "ERR_INTERNAL"
        message = "Unexpected error"
        field = None
    return JSONResponse(status_code=exc.status_code, content=_error_payload(code, message, field))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_error_payload(
            "ERR_VALIDATION",
            str(exc.errors()),
            field=None,
        ),
    )


@app.exception_handler(ProgrammingError)
async def programming_error_handler(_request: Request, exc: ProgrammingError) -> JSONResponse:
    """Missing tables (e.g. employee, lk_org_master) when db/init SQL is only placeholders."""
    logger.error("ProgrammingError on %s", _request.url.path, exc_info=exc)
    raw = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
    missing_table = "does not exist" in raw
    if missing_table:
        hint = (
            "Database tables are missing. On the host, from the ifms-payroll directory, run: "
            "docker compose exec api python scripts/create_dev_tables.py "
            "then docker compose restart api. "
            "If app_login_history is missing, also: docker compose exec -T postgres psql -U postgres -d payroll_db "
            "< db/patches/001_app_login_history.sql"
        )
        if settings.APP_DEBUG:
            hint = f"{hint} (PostgreSQL: {raw[:400]})"
        return JSONResponse(
            status_code=503,
            content=_error_payload("ERR_DB_SCHEMA_INCOMPLETE", hint),
        )
    msg = str(exc) if settings.APP_DEBUG else "Database error"
    return JSONResponse(status_code=500, content=_error_payload("ERR_INTERNAL", msg))


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception on %s", _request.url.path, exc_info=_exc)
    msg = "Unexpected error"
    if settings.APP_DEBUG:
        msg = f"{type(_exc).__name__}: {_exc}"
    return JSONResponse(
        status_code=500,
        content=_error_payload("ERR_INTERNAL", msg),
    )
