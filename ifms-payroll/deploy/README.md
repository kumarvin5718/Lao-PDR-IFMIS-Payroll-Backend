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
| Kubernetes | `deploy/kubernetes/*`, `deploy/kubernetes/README.md` |
| EKS operations | `documents/IFMS_Payroll_AWS_EKS_Deployment.md` |

---

*Product context (Docker production): `documents/IFMS_Payroll_Module_Requirements_v4.md`.*
