#!/usr/bin/env bash
# =============================================================================
# Export payroll reference + transactional data from PostgreSQL (data-only SQL).
#
# Run on the machine that has your populated DB — typically **local desktop**
# with Docker Compose from **ifms-payroll/**:
#
#   chmod +x scripts/export_payroll_data.sh
#   ./scripts/export_payroll_data.sh
#
# Output: db/dumps/payroll_data_export_YYYYMMDD_HHMMSS.sql
#
# Transfer that single file to the server and load with **load_payroll_data.sh**.
#
# Environment:
#   INCLUDE_USERS=0   — omit app_user, manager_scope, dept_officer_scope
#                       (prod already has logins; you usually still need matching
#                       UUIDs in app_user for manager/dept rows — see db/dumps/LOAD_DATA.txt).
#
#   USE_DOCKER=0      — use local pg_dump; set DATABASE_URL (postgresql://user:pass@host:5432/payroll_db)
#
# Does not export: audit_log, celery_taskmeta, alembic_version.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$ROOT_DIR/db/dumps"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$OUT_DIR/payroll_data_export_${STAMP}.sql"
INCLUDE_USERS="${INCLUDE_USERS:-1}"

mkdir -p "$OUT_DIR"

TABLES=(
  lk_pit_brackets
  lk_allowance_rates
  lk_grade_step
  lk_grade_derivation
  lk_ministry_master
  lk_location_master
  lk_org_master
  lk_bank_master
  employee
  payroll_monthly
  payroll_monthly_archive
  upload_session
  upload_session_row
  system_job_log
)

if [[ "$INCLUDE_USERS" == "1" ]]; then
  TABLES=(app_user manager_scope dept_officer_scope "${TABLES[@]}")
fi

USE_DOCKER="${USE_DOCKER:-1}"

compose() {
  (cd "$ROOT_DIR" && docker compose "$@")
}

PGDUMP_TABLE_ARGS=()
for t in "${TABLES[@]}"; do
  PGDUMP_TABLE_ARGS+=(-t "$t")
done

echo "==> Exporting data-only INSERTs for:"
echo "    ${TABLES[*]}"
echo "    INCLUDE_USERS=$INCLUDE_USERS  USE_DOCKER=$USE_DOCKER"
echo "    -> $OUT_FILE"

if [[ "$USE_DOCKER" == "1" ]]; then
  compose exec -T postgres \
    pg_dump -U postgres payroll_db \
    --data-only \
    --no-owner \
    --no-privileges \
    --inserts \
    --column-inserts \
    "${PGDUMP_TABLE_ARGS[@]}" \
    > "$OUT_FILE"
else
  sync_url="$(python3 -c "
import os
u = os.environ.get('DATABASE_URL', '')
u = u.replace('postgresql+asyncpg://', 'postgresql://').replace('postgresql+psycopg2://', 'postgresql://')
print(u)
")"
  if [[ -z "$sync_url" || "$sync_url" == "postgresql://" ]]; then
    echo "ERROR: Set DATABASE_URL for USE_DOCKER=0" >&2
    exit 1
  fi
  pg_dump "$sync_url" \
    --data-only --no-owner --no-privileges --inserts --column-inserts \
    "${PGDUMP_TABLE_ARGS[@]}" \
    > "$OUT_FILE"
fi

echo ""
echo "Done."
ls -lh "$OUT_FILE"
echo ""
echo "Next: copy the file to production, then:"
echo "  ./scripts/load_payroll_data.sh $OUT_FILE"
echo "Read db/dumps/LOAD_DATA.txt for duplicate-key and security notes."
