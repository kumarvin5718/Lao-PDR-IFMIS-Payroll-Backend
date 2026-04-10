#!/usr/bin/env bash
# Creates application DB role expected by DATABASE_URL (docker-compose api/celery).
# DB_APP_PASS must be set on the postgres service (same value as in .env).
set -euo pipefail

if [ -z "${DB_APP_PASS:-}" ]; then
  echo "02_payroll_app_role.sh: DB_APP_PASS is not set; skipping payroll_app role creation." >&2
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payroll_app') THEN EXECUTE format('CREATE ROLE payroll_app LOGIN PASSWORD %L', '${DB_APP_PASS}'); END IF; END \$\$;"

# PostgreSQL 15+: payroll_app must be able to CREATE TABLE in public (create_dev_tables.py).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "GRANT USAGE, CREATE ON SCHEMA public TO payroll_app;"
