# Kubernetes (EKS) — IFMS Payroll

**Parent index:** [`../README.md`](../README.md) — Docker Compose vs Kubernetes, file checklist, and **PostgreSQL / zip handoff** notes.

Starter manifests for **API**, **Celery worker**, **Celery beat**, and a **ConfigMap**. See **`documents/IFMS_Payroll_AWS_EKS_Deployment.md`** (repo root) for ECR. **RDS / ElastiCache security groups, ALB Ingress, and smoke tests:** **`DAY11_CONNECTIVITY.md`** in this folder.

## Before `kubectl apply`

1. **Build & push** the backend image to ECR (same image for API + Celery):

   ```bash
   cd ifms-payroll/backend
   docker build -t ifms-payroll-api:latest .
   # Tag & push per your account/region — see EKS deployment doc §4–5
   ```

2. **Edit** `kustomization.yaml` → `images` block: set `newName` to your ECR repo URL and `newTag` to the pushed tag.

3. **Create the Secret** (not committed):

   ```bash
   kubectl create namespace ifms-payroll  # if not using kustomize namespace resource alone
   kubectl create secret generic ifms-payroll-app-secrets -n ifms-payroll --from-env-file=./prod.env
   ```

   Use `secret-env.example` as a checklist for required keys.

4. **Apply**:

   ```bash
   kubectl apply -k deploy/kubernetes
   ```

5. **Migrations**: run Alembic as a **Job** (see EKS doc §10) before relying on new schema.

6. **Ingress (optional):** copy `ingress-alb.yaml.example`, fill subnets + ACM ARN + host, apply separately (requires AWS Load Balancer Controller).

## What is not included here

- Nginx + static frontend (build `dist/` into an image or serve from CDN)
- `PersistentVolumeClaim` for uploads/reports (use EFS/S3 or emptyDir for single-replica dev only)
- Superset deployment (optional; trim `SUPERSET_*` from config if unused)
