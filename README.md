# IFMS (workspace)

This folder is the **IFMS project workspace**. The runnable payroll application lives under **`ifms-payroll/`**.

## Start here (new developer / fresh deployment)

Earlier deployments and server volumes do **not** need to exist. Treat this as a **greenfield** setup:

1. Open **`ifms-payroll/README.md`** — quick path and links.
2. Follow **`ifms-payroll/deploy/README.md`** — full Docker Compose deployment (`.env`, `docker compose up`, database bootstrap).

**Minimum path:**

```bash
cd ifms-payroll
cp .env.example .env   # edit secrets — see deploy/README.md
docker compose up -d --build
chmod +x scripts/first_deploy_apply_database.sh
./scripts/first_deploy_apply_database.sh
```

Then use the UI at **`https://<host>:18443`** (default). Change the default **`admin`** password after first login.

## What else is in this workspace

| Path | Purpose |
|------|---------|
| **`ifms-payroll/`** | Application: FastAPI, React, Postgres, Valkey/Celery, Nginx, optional Superset |
| **`documents/`** | Requirements, EKS deployment notes, spreadsheets (reference only) |
| **`scripts/`** | Project-level scripts (e.g. activity tracker), not required for payroll bring-up |
| **`docs/`** | Miscellaneous docs |

Kubernetes / AWS EKS: **`ifms-payroll/deploy/kubernetes/README.md`** and **`documents/IFMS_Payroll_AWS_EKS_Deployment.md`** (paths relative to this repo root).

## Security

Do **not** commit **`.env`**, production database dumps, or secrets. Share this tree via a **private** channel if it contains real configuration.
