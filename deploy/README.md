# IFMS Payroll — deployment guide

This document is the **primary reference for developers** deploying the stack with **Docker Compose** (single host or VM). Paths are relative to the **`ifms-payroll/`** directory (the folder that contains `docker-compose.yml`).

If you received a **copy of the project folder** with no prior servers or databases, that is fine: follow **§1–3** in order (`.env` → `docker compose up` → first-deploy DB script). You do not need old deployment artifacts.

For **AWS EKS**, see [§ Kubernetes](#kubernetes-aws-eks--optional) and `kubernetes/README.md`.

---

## Prerequisites

- **Docker** and **Docker Compose** v2 (plugin or `docker compose`).
- Ports available on the host (defaults): **18443** (HTTPS UI), **8000** (API, optional direct access).
- At least **~4 GB RAM** recommended if running Postgres, API, Celery, Nginx, and Superset together.

---

## 1. Get the code and configure environment

1. Clone or copy the project and go to the service root:

   ```bash
   cd ifms-payroll
   ```

2. Create **`.env`** from the template and **set strong secrets** (never commit `.env`):

   ```bash
   cp .env.example .env
   ```

3. Edit **`.env`**. Minimum variables Compose injects into services:

   | Variable | Purpose |
   |----------|---------|
   | `DB_ROOT_PASS` | PostgreSQL superuser password |
   | `DB_APP_PASS` | App role `payroll_app` (used in `DATABASE_URL`) |
   | `JWT_SECRET_KEY` | JWT signing — **≥ 32 characters** |
   | `VALKEY_PASS` | Valkey/Redis password |
   | `SUPERSET_*` | Superset DB user and admin (if you use Superset) |
   | `FLOWER_PASS` | Flower basic auth (Celery monitor) |

   Optional (see comments in `.env.example`):

   - `COOKIE_SECURE=false` — if testing API over plain HTTP without HTTPS in front.
   - `PAYROLL_RUN_SYNC=true` — run payroll **synchronously** in the API process (avoids Celery for bulk runs; set only when needed).
   - `APP_DEBUG=true` — verbose errors (development only).

---

## 2. Build and start the stack

From **`ifms-payroll/`**:

```bash
docker compose up -d --build
```

This starts **PostgreSQL**, **Valkey**, **API**, **Celery worker**, **Celery beat**, **Nginx**, **Superset**, and **Flower** (see `docker-compose.yml` for the full list).

**Frontend (static SPA in Nginx):** If you need a **fresh production build** of the React app baked into the `frontend_build` volume:

```bash
docker compose --profile build run --rm frontend_builder
```

Then restart Nginx if needed: `docker compose restart nginx`.

---

## 3. Initialize the database (required)

**Without this step, the UI may load but API calls return HTTP 503** — tables for masters, lookups, employees, and payroll do not exist until schema + seed are applied.

Run the **first-deploy** script (extensions → ORM tables → seed SQL → triggers → `payroll_all` view → admin user → Alembic → service restarts):

```bash
chmod +x scripts/first_deploy_apply_database.sh
./scripts/first_deploy_apply_database.sh
```

**Optional — sample employees** (large SQL, for payroll testing similar to a full local DB):

```bash
./scripts/first_deploy_apply_database.sh --with-sample-data
```

Equivalent manual path: `db/README_BOOTSTRAP.md` and `scripts/bootstrap_full_database.sh`.

**Verify:**

```bash
docker compose exec -T postgres psql -U postgres -d payroll_db -c \
  "SELECT 'lk_grade_step', COUNT(*) FROM lk_grade_step
   UNION ALL SELECT 'employee', COUNT(*) FROM employee;"
```

You should see **non-zero** `lk_grade_step`. `employee` is **0** until you use `--with-sample-data` or load your own data.

**Default login** after bootstrap (change in production): **`admin`** / **`password123456`**.

### What is populated automatically vs empty

| Data | After normal `./scripts/first_deploy_apply_database.sh` |
|------|-----------------------------------------------------------|
| PIT brackets, allowance rates, grade/step/derivation | Yes (`db/init/08_seed_data.sql`) |
| **Ministry master** (`lk_ministry_master`) | Yes — Python seed after step 08 |
| **Location master** (districts / provinces) | Yes — `backend/alembic/seeds/lk_location_master_154.sql` |
| **Organisation master** (`lk_org_master`), **bank master** (`lk_bank_master`) | No — add via UI, or load optional sample file (below) |
| **Employees**, **payroll** | No until you create employees or load sample data |
| **Manager master**, **Dept. officer master** (`manager_scope`, `dept_officer_scope`) | No — these are **assignment** tables; admins create rows in the app |

**Optional demo dataset** (organisations, banks, ~500 employees — large SQL):

```bash
./scripts/first_deploy_apply_database.sh --with-sample-data
# or: ./scripts/bootstrap_full_database.sh --with-sample-data
```

**Bank list from Excel:** copy `LaoPayrollToolkit v5.xlsx` into the project (e.g. `documents/`) and run:

```bash
TOOLKIT_XLSX="/path/to/LaoPayrollToolkit v5.xlsx" docker compose exec -T api python -m app.db.seeds.seed_bank_master_from_toolkit
```

---

## 4. Access the application

| What | URL (default) |
|------|----------------|
| **Web UI (HTTPS)** | `https://<host>:18443` |
| **OpenAPI docs** | `https://<host>:18443/docs` (proxied to API) or `http://<host>:8000/docs` if port 8000 is exposed |
| **API base** | `https://<host>:18443/api/v1/...` (via Nginx) |

Use a **trusted certificate** in production (`nginx/certs/`); the repo may ship dev self-signed certs for local use.

---

## 5. Troubleshooting

### HTTP 503 on `/api/v1/master/*`, `/api/v1/lookups/*`, employees, payroll

**Symptom:** The SPA loads (e.g. `https://host:18443`) but API calls return **503**. Local Docker works.

**Cause:** **Missing or incomplete PostgreSQL tables** — the API maps “relation does not exist” to **503** (`ERR_DB_SCHEMA_INCOMPLETE`). Masters, lookups, **and** payroll tables (`employee`, `payroll_monthly`, …) all come from the same bootstrap.

**Fix:**

```bash
chmod +x scripts/first_deploy_apply_database.sh
./scripts/first_deploy_apply_database.sh
```

Hard-refresh the browser. This is **not** fixed by frontend-only changes.

**Optional — sample employees** (not required to clear 503; use for payroll testing):

```bash
./scripts/first_deploy_apply_database.sh --with-sample-data
```

**Verify:**

```bash
docker compose exec -T postgres psql -U postgres -d payroll_db -c \
  "SELECT 'lk_grade_step', COUNT(*) FROM lk_grade_step UNION ALL SELECT 'employee', COUNT(*) FROM employee;"
```

### NOTICE: trigger `...` for relation `lk_*` / `employee` "does not exist, skipping"

**Not an error.** On the **first** bootstrap, `DROP TRIGGER IF EXISTS` runs before any trigger exists, so PostgreSQL prints a **NOTICE** per table. The script continues and **`CREATE TRIGGER`** succeeds. Recent `07_triggers.sql` sets `client_min_messages` so these notices are usually hidden.

If table names in your log look wrong (`Uk_*` / `Ik_*`), that is almost always **lowercase `lk` misread as `Uk`/`Ik`** when copying from the terminal — real names are **`lk_*`** (letter **l**, letter **k**).

### `permission denied for schema public` during `first_deploy_apply_database.sh` / `create_dev_tables`

**Symptom:** `psycopg2.errors.InsufficientPrivilege: permission denied for schema public` when creating `app_user` (or any table) as `payroll_app`.

**Cause:** PostgreSQL **15+** no longer grants **CREATE** on the **public** schema to everyone. The API connects as **`payroll_app`**, which needs **`USAGE` + `CREATE`** on `public`.

**Fix (pick one):**

1. **Pull latest** and re-run the database script — it applies `db/bootstrap_payroll_app_grants.sql` before `create_all`:

   ```bash
   ./scripts/first_deploy_apply_database.sh
   ```

2. **One-off** as superuser (then retry bootstrap):

   ```bash
   docker compose exec -T postgres psql -U postgres -d payroll_db -c \
     "GRANT USAGE, CREATE ON SCHEMA public TO payroll_app;"
   ```

New Docker volumes also run `db/init/02_payroll_app_role.sh`, which now includes the same grant.

### Alembic: `DROP CONSTRAINT` / `employee_service_province_fkey` does not exist

**Symptom:** Step `[3/4] Alembic migrations` fails with `UndefinedObject` / `constraint ... does not exist` on `employee` (often `employee_service_province_*`).

**Cause:** Schema is created by **`create_dev_tables.py`** (`employee.service_province` is a plain string — **no FK** to `lk_location_master`). An **old or local-only** Alembic revision may try to **drop** a foreign key that was never created. The repo ships a **no-op baseline** revision only (`backend/alembic/versions/0001_baseline.py`).

**Fix:**

1. **Pull latest**, remove any **extra** `*.py` files you added under `backend/alembic/versions/` that are not from this repo, then rebuild the API image:

   ```bash
   docker compose build --no-cache api celery_worker
   docker compose up -d api celery_worker
   ```

2. If the database still has a stale row in **`alembic_version`** pointing at a missing revision, align it to the baseline **without** re-running bad SQL:

   ```bash
   docker compose exec -T api alembic stamp 0001_baseline
   ```

   Or clear and stamp on a **throwaway** dev DB:

   ```bash
   docker compose exec -T postgres psql -U postgres -d payroll_db -c "DELETE FROM alembic_version;"
   docker compose exec -T api alembic upgrade head
   ```

### API or Celery container unhealthy

```bash
docker compose ps
docker compose logs api --tail 100
docker compose logs celery_worker --tail 80
```

### Rebuild after code changes

```bash
docker compose build api celery_worker
docker compose up -d api celery_worker
```

---

## Copying a populated database to another environment (no app code changes)

To mirror **local desktop** data (masters, employees, payroll, manager/dept scopes) to **production** using only SQL:

1. **Export** on the machine that has the data (from **`ifms-payroll/`**):

   ```bash
   ./scripts/export_payroll_data.sh
   ```

   Produces **`db/dumps/payroll_data_export_*.sql`**. The file may contain **PII** — treat as secret; it is gitignored.

2. **Copy** that file to the server (scp, etc.).

3. **Back up production** (`pg_dump` full database) before loading.

4. **Load** on the server:

   ```bash
   ./scripts/load_payroll_data.sh db/dumps/payroll_data_export_....sql
   ```

Details, `INCLUDE_USERS=0`, and duplicate-key behaviour: **`db/dumps/LOAD_DATA.txt`**.

If load fails on **`app_user`** with **boolean vs integer**, align the target schema first:

```bash
docker compose exec -T postgres psql -U postgres -d payroll_db -v ON_ERROR_STOP=1 \
  < db/patches/007_app_user_schema_alignment.sql
```

The Postgres container does not mount the project tree, so **`psql -f db/patches/...` fails** (path only exists on the host). **Redirect stdin** from the host file as above.

If **`load_payroll_data.sh` still errors on `app_user`** (`force_password_change` boolean vs integer), the dump likely has `'en', true, false, 0` without **`registration_status`**. Patch the file, then load:

```bash
python3 scripts/patch_payroll_dump_app_user.py ./scripts/payroll_data_export_....sql -o /tmp/payroll_fixed.sql
./scripts/load_payroll_data.sh /tmp/payroll_fixed.sql
```

---

## PostgreSQL data and project archives

- **A zip of the source tree does not include live database files.** Postgres data lives in a **Docker volume** (e.g. `postgres_data`), not inside the project folder.
- To move data between environments, use **`pg_dump`** / restore, or run the bootstrap scripts on the new server.
- Do **not** commit **`.env`** or production dumps to public repositories.

---

## Kubernetes (AWS EKS) — optional

| Resource | Location |
|----------|----------|
| Kustomize manifests | `deploy/kubernetes/` |
| Apply | `kubectl apply -k deploy/kubernetes` (from `ifms-payroll`) |
| ECR, RDS, jobs | `documents/IFMS_Payroll_AWS_EKS_Deployment.md` (repo root `documents/`) |
| Secrets checklist | `deploy/kubernetes/secret-env.example` |
| RDS / ingress / smoke tests | `deploy/kubernetes/DAY11_CONNECTIVITY.md` |

Start with **`deploy/kubernetes/README.md`**.

---

## Quick filename reference

| Purpose | File(s) |
|---------|---------|
| Stack definition | `docker-compose.yml` |
| Environment template | `.env.example` → **`.env`** |
| Nginx + TLS | `nginx/nginx.conf`, `nginx/certs/` |
| First-time DB (recommended) | **`scripts/first_deploy_apply_database.sh`** |
| Manual bootstrap / details | `scripts/bootstrap_full_database.sh`, `db/README_BOOTSTRAP.md` |
| Export / load DB rows (local → prod, SQL only) | **`scripts/export_payroll_data.sh`**, **`scripts/load_payroll_data.sh`**, `db/dumps/LOAD_DATA.txt` |
| Kubernetes | `deploy/kubernetes/*`, `deploy/kubernetes/README.md` |
| EKS operations | `documents/IFMS_Payroll_AWS_EKS_Deployment.md` |

---

*Product context (Docker production): `documents/IFMS_Payroll_Module_Requirements_v4.md`.*
