# Full database bootstrap (schema + data)

Use this when you have an **empty** (or reset) PostgreSQL database and need **tables, lookup seed, audit triggers, `payroll_all` view, and the dev `admin` user**.

## Quick start (Docker Compose)

From the **`ifms-payroll/`** directory, with Postgres and API containers running:

```bash
chmod +x scripts/bootstrap_full_database.sh
./scripts/bootstrap_full_database.sh
```

Optional: also load **sample employees** from `init/09_sample_data.sql` (large):

```bash
./scripts/bootstrap_full_database.sh --with-sample-data
```

## What runs (order)

1. `db/bootstrap_extensions.sql` — `pg_trgm`, `unaccent`
2. `backend/scripts/create_dev_tables.py` — SQLAlchemy `create_all` (all ORM tables)
3. `db/patches/005_align_legacy_schema.sql` (if present) — adds columns / relaxes constraints on **older** DB volumes; harmless on empty DBs
4. `db/init/08_seed_data.sql` — lookup / rate / PIT seed data
5. `db/patches/003_pit_brackets_income_from.sql` — idempotent **GDT PIT** `income_from_lak` alignment (SRS §8.9; safe if seed already matches)
6. `db/init/07_triggers.sql` — audit triggers on lookup tables
7. `db/patches/004_audit_triggers_employee_payroll.sql` — employee/payroll audit triggers (if file exists)
8. `db/patches/002_payroll_all_view.sql` — `payroll_all` view (if file exists)
9. `db/bootstrap_seed_admin.sql` — dev user **`admin` / `password123456`**
10. Optional: `db/init/09_sample_data.sql`

## Local Postgres (no Docker)

```bash
export USE_DOCKER=0
cd backend && set -a && source ../.env && set +a && cd ..
# Or export DATABASE_URL, VALKEY_URL, SECRET_KEY, CELERY_BROKER_URL, SUPERSET_* per backend/.env.template
./scripts/bootstrap_full_database.sh
```

`create_dev_tables.py` uses the same env as the API (`backend/app/config.py`).

## Security

Change the default admin password immediately in non-dev environments. Use `db/patches/003_sync_dev_admin_password.sql` only to repair a known hash for `password123456`.

## Related

- `docs/runbook_production.md` — step-by-step bring-up (overlaps with this script)
- `db/init/09_app_user.sql` — legacy full file; bootstrap uses `bootstrap_seed_admin.sql` for the INSERT only (avoids old role `CHECK` DDL conflicts)
