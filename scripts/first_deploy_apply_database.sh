#!/usr/bin/env bash
# =============================================================================
# First-time / recovery: apply full DB schema + seed after Docker Compose is up.
#
# Fixes: HTTP 503 on /api/v1/master/*, /api/v1/lookups/*, /api/v1/employees*, and
#        other routes that query PostgreSQL — all use the same ORM tables created here.
#
# Payroll: employee, payroll_monthly, payroll_all view, etc. are created by the same
# bootstrap as lk_grade_step (scripts/bootstrap_full_database.sh → create_dev_tables.py).
# Without optional sample data you get empty lists / “0 processed” on payroll run — not 503.
#
# Run on the deployment host from the ifms-payroll/ directory:
#   chmod +x scripts/first_deploy_apply_database.sh
#   ./scripts/first_deploy_apply_database.sh
# Optional — load large sample employees (same as local “full” dataset for payroll testing):
#   ./scripts/first_deploy_apply_database.sh --with-sample-data
#
# Requires: docker compose; .env configured.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BOOTSTRAP_EXTRA=()
for a in "$@"; do
  if [[ "$a" == "--with-sample-data" ]]; then
    BOOTSTRAP_EXTRA+=(--with-sample-data)
  fi
done

echo "==> [1/4] Ensure core services are up (API + Valkey + Celery for payroll jobs)"
docker compose up -d postgres valkey api celery_worker celery_beat

echo "==> [2/4] Bootstrap schema + seed (masters, payroll tables, payroll_all view, admin)"
export USE_DOCKER="${USE_DOCKER:-1}"
chmod +x scripts/bootstrap_full_database.sh
./scripts/bootstrap_full_database.sh "${BOOTSTRAP_EXTRA[@]}"

echo "==> [3/4] Alembic migrations (additive changes on top of ORM tables)"
docker compose exec -T api alembic upgrade head

echo "==> [4/4] Restart API and Celery workers (schema + seed just applied)"
docker compose restart api celery_worker celery_beat

echo ""
echo "Done. Verify in browser or:"
echo "  docker compose exec -T postgres psql -U postgres -d payroll_db -c \"SELECT COUNT(*) FROM lk_grade_step;\""
echo "  docker compose exec -T postgres psql -U postgres -d payroll_db -c \"SELECT COUNT(*) FROM employee;\""
echo "  curl -sk https://127.0.0.1:18443/docs  (or your host:18443/docs)"
echo "If 503 persists: docker compose logs api --tail 80"
if [[ ${#BOOTSTRAP_EXTRA[@]} -eq 0 ]]; then
  echo ""
  echo "Note: No sample employees loaded. For payroll testing with a populated employee table:"
  echo "  ./scripts/first_deploy_apply_database.sh --with-sample-data"
  echo "  (or: ./scripts/bootstrap_full_database.sh --with-sample-data)"
fi
