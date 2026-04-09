#!/usr/bin/env bash
# =============================================================================
# IFMS Payroll — full database bootstrap (schema + seed + PIT patch + triggers + view + admin)
#
# Run from the ifms-payroll/ directory (repo root of this service):
#   chmod +x scripts/bootstrap_full_database.sh
#   ./scripts/bootstrap_full_database.sh
#
# Optional:
#   ./scripts/bootstrap_full_database.sh --with-sample-data   # loads db/init/09_sample_data.sql (large)
#
# Prerequisites:
#   - PostgreSQL reachable (local or Docker)
#   - Python 3.11+ with backend deps from backend/requirements.txt (or use Docker mode)
#
# Environment (choose one):
#   A) Docker Compose (recommended): set USE_DOCKER=1 (default) and run from ifms-payroll/
#      where docker compose can reach services postgres + api.
#   B) Local: export DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/payroll_db
#      and set USE_DOCKER=0, then run from ifms-payroll/ with backend/.env loaded.
#
# For local mode, DATABASE_URL must match your API; create_dev_tables.py also needs
# VALKEY_URL, CELERY_BROKER_URL, SECRET_KEY, SUPERSET_* (see backend/.env.template).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_DIR="$ROOT_DIR/db"
BACKEND_DIR="$ROOT_DIR/backend"

WITH_SAMPLE=0
if [[ "${1:-}" == "--with-sample-data" ]]; then
  WITH_SAMPLE=1
fi

USE_DOCKER="${USE_DOCKER:-1}"

# docker compose loads .env from this directory
compose() {
  (cd "$ROOT_DIR" && docker compose "$@")
}

run_psql() {
  local file="$1"
  if [[ "$USE_DOCKER" == "1" ]]; then
    compose exec -T postgres \
      psql -v ON_ERROR_STOP=1 -U postgres -d payroll_db < "$file"
  else
    # sync URL for psql (strip SQLAlchemy drivers)
    local sync_url
    sync_url="$(python3 -c "
import os, re
u = os.environ.get('DATABASE_URL', '')
u = u.replace('postgresql+asyncpg://', 'postgresql://').replace('postgresql+psycopg2://', 'postgresql://')
print(u)
")"
    if [[ -z "$sync_url" || "$sync_url" == "postgresql://" ]]; then
      echo "ERROR: Set DATABASE_URL for USE_DOCKER=0 mode." >&2
      exit 1
    fi
    psql "$sync_url" -v ON_ERROR_STOP=1 -f "$file"
  fi
}

run_python_create_all() {
  if [[ "$USE_DOCKER" == "1" ]]; then
    compose exec -T api \
      python scripts/create_dev_tables.py
  else
    cd "$BACKEND_DIR"
    PYTHONPATH=. python3 scripts/create_dev_tables.py
  fi
}

echo "==> [1/8] Extensions: $DB_DIR/bootstrap_extensions.sql"
run_psql "$DB_DIR/bootstrap_extensions.sql"

echo "==> [2/8] ORM schema (SQLAlchemy create_all)"
run_python_create_all

echo "==> [3/8] Lookup seed: db/init/08_seed_data.sql"
run_psql "$DB_DIR/init/08_seed_data.sql"

if [[ -f "$DB_DIR/patches/003_pit_brackets_income_from.sql" ]]; then
  echo "==> [4/8] PIT bracket thresholds (idempotent): db/patches/003_pit_brackets_income_from.sql"
  run_psql "$DB_DIR/patches/003_pit_brackets_income_from.sql"
else
  echo "==> [4/8] Skip PIT patch (file missing)"
fi

echo "==> [5/8] Audit triggers: db/init/07_triggers.sql"
run_psql "$DB_DIR/init/07_triggers.sql"

if [[ -f "$DB_DIR/patches/004_audit_triggers_employee_payroll.sql" ]]; then
  echo "==> [5b/8] Employee/payroll audit triggers (idempotent patch for older volumes)"
  run_psql "$DB_DIR/patches/004_audit_triggers_employee_payroll.sql"
fi

if [[ -f "$DB_DIR/patches/002_payroll_all_view.sql" ]]; then
  echo "==> [6/8] View payroll_all: db/patches/002_payroll_all_view.sql"
  run_psql "$DB_DIR/patches/002_payroll_all_view.sql"
else
  echo "==> [6/8] Skip payroll_all view (file missing)"
fi

echo "==> [7/8] Dev admin user: db/bootstrap_seed_admin.sql"
run_psql "$DB_DIR/bootstrap_seed_admin.sql"

if [[ "$WITH_SAMPLE" == "1" ]]; then
  echo "==> [8/8] optional sample data: db/init/09_sample_data.sql (may take a while)"
  run_psql "$DB_DIR/init/09_sample_data.sql"
else
  echo "==> [8/8] Skip sample employees (pass --with-sample-data to load)"
fi

echo ""
echo "Done. Login: admin / password123456 (change in production)."
echo "If triggers/seed failed on first run, ensure Postgres logs show no earlier init errors."
