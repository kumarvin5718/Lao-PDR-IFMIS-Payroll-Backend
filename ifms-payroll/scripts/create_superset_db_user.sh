#!/usr/bin/env bash
# One-time (or repair): create PostgreSQL role for Superset when db/init already ran
# without 025_superset_db_user.sh (existing postgres_data volume).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
set -a
[ -f .env ] && . ./.env
set +a

USER="${SUPERSET_DB_USER:-superset_user}"
PASS="${SUPERSET_DB_PASS:-}"
if [ -z "$PASS" ]; then
  echo "SUPERSET_DB_PASS must be set in .env" >&2
  exit 1
fi

SUPERSET_DB_NAME="${SUPERSET_DATABASE_DB:-superset_db}"

echo "Creating/updating role ${USER} in postgres..."
docker compose exec -T postgres psql -U postgres -d payroll_db -v ON_ERROR_STOP=1 <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${USER}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${USER}', '${PASS}');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', '${USER}', '${PASS}');
  END IF;
END
\$\$;
GRANT CONNECT ON DATABASE payroll_db TO ${USER};
GRANT CREATE, USAGE ON SCHEMA public TO ${USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${USER};
EOSQL

echo "Ensuring dedicated Superset metadata database ${SUPERSET_DB_NAME} exists..."
EXISTS=$(docker compose exec -T postgres psql -U postgres -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname = '${SUPERSET_DB_NAME}'")
if [ "$EXISTS" != "1" ]; then
  docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${SUPERSET_DB_NAME};"
fi
docker compose exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE ${SUPERSET_DB_NAME} TO ${USER};"
docker compose exec -T postgres psql -U postgres -d "${SUPERSET_DB_NAME}" -v ON_ERROR_STOP=1 <<EOSQL
GRANT CREATE, USAGE ON SCHEMA public TO ${USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${USER};
EOSQL

echo "Done. Run: docker compose exec superset superset db upgrade"
echo "Then: docker compose exec superset superset fab create-admin   (if no admin yet)"
echo "Restart Superset: docker compose restart superset"
