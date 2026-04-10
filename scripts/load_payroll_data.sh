#!/usr/bin/env bash
# =============================================================================
# Load a data-only SQL dump produced by **export_payroll_data.sh** into PostgreSQL.
#
# Run from **ifms-payroll/** on the target environment (e.g. production server):
#
#   chmod +x scripts/load_payroll_data.sh
#   ./scripts/load_payroll_data.sh db/dumps/payroll_data_export_YYYYMMDD_HHMMSS.sql
#
# Uses: docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d payroll_db
#
# Environment:
#   USE_DOCKER=0  — psql on host with DATABASE_URL (postgresql://...)
#
# **Before production:** back up the database (pg_dump full). This script does not
# truncate tables; INSERT may fail on duplicate keys — see db/dumps/LOAD_DATA.txt.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
USE_DOCKER="${USE_DOCKER:-1}"

if [[ "${1:-}" == "" ]]; then
  echo "Usage: $0 /path/to/payroll_data_export_*.sql" >&2
  echo "Run from ifms-payroll/ (where docker-compose.yml lives), e.g.:" >&2
  echo "  ./scripts/load_payroll_data.sh ./scripts/payroll_data_export_YYYYMMDD_HHMMSS.sql" >&2
  echo "Do not execute the .sql file with ./file.sql — that runs SQL through bash and will fail." >&2
  exit 1
fi

SQL_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
if [[ ! -f "$SQL_FILE" ]]; then
  echo "ERROR: File not found: $SQL_FILE" >&2
  exit 1
fi

compose() {
  (cd "$ROOT_DIR" && docker compose "$@")
}

echo "==> Loading: $SQL_FILE"

if [[ "$USE_DOCKER" == "1" ]]; then
  compose exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U postgres -d payroll_db < "$SQL_FILE"
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
  psql "$sync_url" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
fi

echo "==> Load finished."
