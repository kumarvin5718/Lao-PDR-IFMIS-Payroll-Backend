# IFMS Payroll — deployment (developer handoff)

Use this folder as the **deployment index**. Paths below are relative to the **`ifms-payroll/`** directory unless noted.

---

## 1. Docker Compose (local / single host)

| What | File |
|------|------|
| Stack definition | `docker-compose.yml` |
| Environment template | `.env.example` → copy to **`.env`** (same directory as `docker-compose.yml`) |
| Nginx TLS + routing | `nginx/nginx.conf`, TLS under `nginx/certs/` |
| DB init scripts (first container start) | `db/init/` |
| Full schema + seed after DB is up | `db/README_BOOTSTRAP.md` and `scripts/bootstrap_full_database.sh` |

**Typical flow**

1. `cd ifms-payroll`
2. `cp .env.example .env` and edit secrets (passwords, `JWT_SECRET_KEY`, etc.).
3. `docker compose up -d --build` (add `--profile build` and run `frontend_builder` if you need a fresh static build into the nginx volume).
4. Run Alembic migrations if your process expects them (see `backend/` — e.g. `alembic upgrade head` against the DB URL your team uses), and/or run **`./scripts/bootstrap_full_database.sh`** per `db/README_BOOTSTRAP.md` for an empty database.

**URLs (default compose):** API on host port **8000**; full stack behind nginx at **https://localhost:18443** (see comments in `docker-compose.yml`).

---

## 2. Kubernetes (AWS EKS / production-style)

| What | File or folder |
|------|----------------|
| Step-by-step (ECR, cluster, migrations) | **`../../documents/IFMS_Payroll_AWS_EKS_Deployment.md`** (repo root `documents/`) |
| Kustomize base + manifests | **`kubernetes/`** — start with **`kubernetes/README.md`** |
| RDS / ElastiCache / Ingress / smoke tests | **`kubernetes/DAY11_CONNECTIVITY.md`** |
| Secret key checklist (do not commit real values) | **`kubernetes/secret-env.example`** |
| Optional ALB Ingress | Copy **`kubernetes/ingress-alb.yaml.example`** → edit → apply |

Apply from `ifms-payroll`:

```bash
kubectl apply -k deploy/kubernetes
```

(Image tag and ECR URL are edited in `kubernetes/kustomization.yaml`.)

---

## 3. PostgreSQL data and zipping the project

**The project zip does *not* include your live PostgreSQL data by default.**

- Compose stores Postgres in a **named Docker volume** (`postgres_data` in `docker-compose.yml`), which lives under Docker’s storage on the machine, **not** inside the project folder.
- **Valkey**, **uploads**, **reports**, **Superset home**, and the **frontend build** volume behave the same way: they are **not** part of a normal source zip.

**To give a developer your actual data**, choose one of:

- **`pg_dump`** (or `pg_dumpall`) to a `.sql` or custom format file you add to the handoff (keep it out of public repos if it contains real data), or  
- Document how they should run **`bootstrap_full_database.sh`** and any seed steps so they get a **fresh** dev database.

**What *does* travel in the zip:** application code, `db/init/` scripts, migrations under `backend/`, and configuration **templates** (e.g. `.env.example`). **Secrets** should stay out of the archive or be replaced with placeholders—use `.env.example` as the checklist.

---

## 4. Quick filename checklist for developers

| Purpose | File(s) |
|---------|---------|
| Compose deployment | `docker-compose.yml`, `.env` (from `.env.example`) |
| TLS for nginx | `nginx/nginx.conf`, `nginx/certs/` |
| DB bootstrap / seed | `db/README_BOOTSTRAP.md`, `scripts/bootstrap_full_database.sh` |
| EKS / kubectl | `deploy/kubernetes/README.md`, `deploy/kubernetes/kustomization.yaml`, `deploy/kubernetes/*.yaml` |
| EKS operations guide | `documents/IFMS_Payroll_AWS_EKS_Deployment.md` |
| Prod connectivity / RDS | `deploy/kubernetes/DAY11_CONNECTIVITY.md` |
| Secret template for K8s | `deploy/kubernetes/secret-env.example` |

---

*For product requirements context (Docker production section), see `documents/IFMS_Payroll_Module_Requirements_v4.md`.*
