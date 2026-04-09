#!/usr/bin/env bash
# Creates the DB login role used by docker-compose `superset` (superset_config.py SQLALCHEMY URI).
# Requires SUPERSET_DB_USER / SUPERSET_DB_PASS on the postgres service (same as .env).
set -euo pipefail

USER="${SUPERSET_DB_USER:-superset_user}"
PASS="${SUPERSET_DB_PASS:-}"

if [ -z "$PASS" ]; then
  echo "025_superset_db_user.sh: SUPERSET_DB_PASS is not set; skipping Superset DB user creation." >&2
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${USER}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${USER}', '${PASS}');
  END IF;
END
\$\$;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO ${USER};"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "GRANT CREATE, USAGE ON SCHEMA public TO ${USER};"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${USER};"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${USER};"
