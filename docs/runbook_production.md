# IFMS Payroll — production-style bring-up checklist

Paths are relative to the `ifms-payroll/` directory unless noted. Use **`https://localhost:18443`** for the app (nginx maps host **18443** → container **443**). Plain `https://localhost` without the port is wrong for the default Docker Compose setup.

---

## 1. Environment

```bash
cp .env.template .env
```

Edit `.env`: replace **all** `changeme_` values. **`JWT_SECRET_KEY`** must be **≥ 32 characters**.

---

## 2. Build frontend (optional profile)

```bash
docker compose --profile build run --rm frontend_builder
```

---

## 3. Start stack

```bash
docker compose up -d
docker compose ps
```

Expect **8** running containers (e.g. nginx, api, celery_worker, celery_beat, flower, postgres, valkey, superset). The `frontend_builder` service uses profile `build` and is not a long-running “Up” service.

---

## 4. Postgres init logs

```bash
docker compose logs postgres 2>&1 | grep -E "(ERROR|ready to accept)"
```

Expect: `database system is ready to accept connections`. Investigate any **ERROR** during numbered init scripts.

**Note:** `db/init/07_triggers.sql` and `08_seed_data.sql` assume **ORM tables** (`audit_log`, `lk_*`, …) already exist. Those are created by **`create_dev_tables.py`**, not by default Postgres init. On first boot, init may log errors for 07/08 if tables are missing; apply triggers/seed **after** step 5–6.

---

## 5. ORM tables + seed + triggers (required for lookup data)

**One-shot option (recommended):** from the `ifms-payroll/` directory with Compose running, run:

```bash
chmod +x scripts/bootstrap_full_database.sh
./scripts/bootstrap_full_database.sh
```

This applies extensions, `create_dev_tables.py`, `08_seed_data.sql`, **`003_pit_brackets_income_from.sql`** (PIT thresholds), `07_triggers.sql`, `002_payroll_all_view.sql`, and the dev **`admin`** user (`db/bootstrap_seed_admin.sql`). See **`db/README_BOOTSTRAP.md`** for details and `--with-sample-data`.

**Existing DBs** (bootstrap already run): apply `db/patches/003_pit_brackets_income_from.sql` once if you still see `1300001` / `5000001` style thresholds — or re-run the full bootstrap script (idempotent).

**Manual equivalent:**

```bash
docker compose exec api python scripts/create_dev_tables.py
docker compose exec -T postgres psql -U postgres -d payroll_db < db/init/08_seed_data.sql
docker compose exec -T postgres psql -U postgres -d payroll_db < db/init/07_triggers.sql
```

If **`lk_allowance_rates`** or **`lk_org_master`** constraints were created before model fixes, you may need to align checks/constraints once (see project history), then re-run the seed.

---

## 6. Rebuild API image (after backend config changes)

The API image **does not mount** source code. After changing `app/config.py`, `alembic/env.py`, or similar, rebuild before Alembic:

```bash
docker compose build api
docker compose up -d api
```

---

## 7. Alembic migrations

Migrations use **`ALEMBIC_DATABASE_URL`** (postgres superuser) in Compose so indexes on init-owned tables (e.g. `app_login_history`) succeed.

```bash
docker compose exec api alembic upgrade head
```

Expect something like: `Running upgrade -> 0001` then `0001 -> 0002` on a fresh DB.

---

## 8. Verify seed data

```bash
docker compose exec postgres psql -U postgres payroll_db -c \
  "SELECT COUNT(*) FROM lk_grade_step;"
# Expect: 150

docker compose exec postgres psql -U postgres payroll_db -c \
  "SELECT amount_or_rate FROM lk_allowance_rates
   WHERE allowance_name = 'Salary Index Rate (ຄ່າດັດສະນີ — LAK per Index Point)';"
# Expect: 10000

docker compose exec postgres psql -U postgres payroll_db -c \
  "SELECT bracket_no, rate_pct FROM lk_pit_brackets ORDER BY bracket_no;"
# Expect: 6 rows — 0, 5, 10, 15, 20, 24

docker compose exec postgres psql -U postgres payroll_db -c \
  "SELECT bracket_no, income_from_lak FROM lk_pit_brackets ORDER BY bracket_no;"
# Expect: 0; 1300000; 5000000; 12000000; 25000000; 65000000 (GDT / SRS §8.9)

docker compose exec postgres psql -U postgres payroll_db -c \
  "SELECT amount_or_rate FROM lk_allowance_rates
   WHERE allowance_name LIKE '%SSO Employee%';"
# Expect: 0.055
```

---

## 9. Audit triggers registered

```bash
docker compose exec postgres psql -U postgres payroll_db -c \
  "SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_audit_%';"
# Expect: 7 rows
```

---

## 10. Test trigger (`app.audit_user`)

PostgreSQL reserves **`current_user`**. Use **`app.audit_user`** (via `set_config`, not `SET app.current_user`). Example:

```bash
docker compose exec -T postgres psql -U postgres -d payroll_db -c "
BEGIN;
SELECT set_config('app.audit_user', 'seed_test', true);
SELECT set_config('app.circular_ref', 'test', true);
SELECT set_config('app.change_remarks', 'trigger verification', true);
UPDATE lk_allowance_rates SET change_remarks = 'test'
WHERE allowance_name LIKE '%SSO Employee%';
SELECT COUNT(*) FROM audit_log WHERE changed_by = 'seed_test';
COMMIT;"
# Expect count: 1
```

The FastAPI app sets **`app.audit_user`** per request in `database.py` (session `set_config`).

---

## 11. Superset

Create the **`payroll_all`** view (for dashboards) after **`create_dev_tables.py`**:

```bash
docker compose exec -T postgres psql -U postgres -d payroll_db < db/patches/002_payroll_all_view.sql
```

Chart SQL examples: **`docs/superset_dashboard_sql.md`**.

```bash
docker compose exec superset superset db upgrade
docker compose exec superset superset fab create-admin \
  --username "$SUPERSET_ADMIN_USER" \
  --firstname Admin --lastname Admin \
  --email admin@payroll.la \
  --password "$SUPERSET_ADMIN_PASS"
docker compose exec superset superset init
```

**Dashboard export/import:** `superset import-dashboards` expects packaged dashboards. **`superset/dashboard_configs/`** may be empty until dashboards exist.

**Option A (recommended for Phase 1):** Build dashboards in the Superset UI (e.g. from the `payroll_all` view), then export:

```bash
docker compose exec superset superset export-dashboards -f /app/superset_home/dashboards/all.zip
```

Commit the artifact under `superset/dashboard_configs/` as your process allows.

**Option B:** Maintain documented SQL for each chart/dashboard as a copy-paste reference for builders (spec separately).

---

## 12. API smoke — guest token (example)

Use **`-k`** if using a self-signed dev certificate.

```bash
curl -s -k -X POST https://localhost:18443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<temp>"}' | jq .data.access_token
```

Use the token:

```bash
curl -s -k "https://localhost:18443/api/v1/superset/guest-token?dashboard_id=1" \
  -H "Authorization: Bearer $TOKEN" | jq .data.token
```

---

## 13. Bulk upload template

```bash
curl -s -k "https://localhost:18443/api/v1/bulk-upload/employee/template" \
  -H "Authorization: Bearer $TOKEN" -o /tmp/template.xlsx
```

---

## 14. Payroll run (with employees present)

```bash
curl -s -k -X POST https://localhost:18443/api/v1/payroll/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month":"2026-03"}' | jq .data.job_id
```

Poll `/api/v1/payroll/jobs/{job_id}` until status **done**.

---

## 15. Celery / Flower

Flower is proxied under nginx; example:

```bash
curl -s -k "https://localhost:18443/flower/" -u "admin:$FLOWER_PASS" | grep -c "archive\|upload"
```

---

## 16. Audit log API

```bash
curl -s -k "https://localhost:18443/api/v1/reports/audit-log" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

---

## 17. RLS / ministry scope

Validate with an HR user scoped to a ministry (create via admin API, then `GET /employees`).

---

## 18. Account lockout

Repeated failed logins should eventually return **`ERR_AUTH_ACCOUNT_LOCKED`** (see auth service thresholds).

---

## 19. Valkey

```bash
docker compose exec valkey valkey-cli -a "$VALKEY_PASS" ping
# Expect: PONG
docker compose exec valkey valkey-cli ping
# Expect: NOAUTH (password required)
```

---

## 20. Static assets / HTTPS

```bash
curl -s -I -k https://localhost:18443/fonts/NotoSerifLao.woff2
curl -s -I http://localhost:18443/
# HTTP should redirect toward HTTPS (nginx config).
```

---

## Quick reference — common pitfalls

| Topic | Correct |
|--------|---------|
| Browser / curl base URL | `https://localhost:18443` |
| Audit session GUC | `app.audit_user` (not `app.current_user`) |
| Alembic in Docker | `ALEMBIC_DATABASE_URL` → postgres; **rebuild api** after code changes |
| Lookup seed | After **`create_dev_tables.py`**, then `08_seed_data.sql`, then `07_triggers.sql` |
| Basic salary | `grade_step_index × salary_index_rate` (see payroll service) |
