#!/usr/bin/env bash
# Dedicated DB for Superset metadata (Alembic must not share alembic_version with payroll migrations).
set -euo pipefail

USER="${SUPERSET_DB_USER:-superset_user}"
DBNAME="${SUPERSET_DATABASE_DB:-superset_db}"

exists=$(psql -v ON_ERROR_STOP=1 -At --username "$POSTGRES_USER" --dbname "postgres" \
  -c "SELECT 1 FROM pg_database WHERE datname = '${DBNAME}'")
if [ "$exists" != "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" \
    -c "CREATE DATABASE ${DBNAME};"
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" \
  -c "GRANT ALL PRIVILEGES ON DATABASE ${DBNAME} TO ${USER};"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${DBNAME}" <<EOSQL
GRANT CREATE, USAGE ON SCHEMA public TO ${USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${USER};
EOSQL
