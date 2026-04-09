# IFMS Payroll

Payroll processing application (FastAPI backend, React frontend, PostgreSQL, Valkey/Celery, optional Superset).

## Quick links

| Topic | Location |
|--------|----------|
| **Full deployment guide (Docker Compose, DB, troubleshooting)** | **[`deploy/README.md`](deploy/README.md)** |
| Database bootstrap details | [`db/README_BOOTSTRAP.md`](db/README_BOOTSTRAP.md) |
| AWS EKS / Kubernetes | [`deploy/kubernetes/README.md`](deploy/kubernetes/README.md) and [`../documents/IFMS_Payroll_AWS_EKS_Deployment.md`](../documents/IFMS_Payroll_AWS_EKS_Deployment.md) |

## Deploy in three commands (after configuring `.env`)

From the **`ifms-payroll/`** directory:

```bash
cp .env.example .env   # edit secrets — see deploy/README.md
docker compose up -d --build
./scripts/first_deploy_apply_database.sh
```

Then open **https://&lt;host&gt;:18443** (default TLS port). Default dev login after bootstrap: **`admin`** / **`password123456`** — change in production.

Details, optional sample data, and troubleshooting: **[`deploy/README.md`](deploy/README.md)**.
