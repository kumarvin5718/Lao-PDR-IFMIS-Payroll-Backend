import os

SECRET_KEY = os.environ["SUPERSET_SECRET_KEY"]

# Dedicated database so Alembic's alembic_version does not clash with payroll migrations in payroll_db.
_db = os.environ.get("SUPERSET_DATABASE_DB", "superset_db")
SQLALCHEMY_DATABASE_URI = (
    f"postgresql+psycopg2://"
    f"{os.environ['SUPERSET_DB_USER']}:{os.environ['SUPERSET_DB_PASS']}"
    f"@postgres:5432/{_db}"
)

WTF_CSRF_ENABLED = False
WTF_CSRF_EXEMPT_LIST = []
SESSION_COOKIE_SAMESITE = "Strict"
# With APPLICATION_ROOT, Flask may set Path=/superset — browser then omits the cookie on /api/v1/* (Superset REST).
SESSION_COOKIE_PATH = "/"
# Served behind nginx at https://host:18443/superset/ — must match proxy_pass path or redirects hit /login (React) and loop.
ENABLE_PROXY_FIX = True
APPLICATION_ROOT = "/superset"
STATIC_ASSETS_PREFIX = "/superset"
SUPERSET_APP_ROOT = "/superset"

FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,  # required for guest token iframe embedding
    "ENABLE_TEMPLATE_PROCESSING": True,  # required for RLS Jinja {{ }} clauses
}

# Allow FastAPI (api:8000) to call the guest_token endpoint cross-origin
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "origins": ["http://api:8000"],  # internal Docker network only
}

# Guest token TTL — 5 min; SDK auto-refreshes
GUEST_TOKEN_JWT_EXP_SECONDS = 300
GUEST_ROLE_NAME = "Gamma"
GUEST_TOKEN_JWT_ALGO = "HS256"

ENABLE_ROW_LEVEL_SECURITY = True

# Silence the default SQLite metastore warning
SUPERSET_WEBSERVER_PORT = 8088
