# IFMS Payroll — AWS EKS Deployment Guide

**Audience:** Operators deploying from a laptop-built image to Amazon EKS  
**Assumptions:** You build container image(s) locally, publish them to **Amazon ECR**, and run workloads on **EKS**. Managed **RDS (PostgreSQL)** and **ElastiCache (Valkey/Redis)** are recommended instead of running databases inside the cluster for production.

---

## 1. Scope and image model

### 1.1 What “single image from my laptop” usually means

In this repository, `docker-compose.yml` builds **one application image** from `ifms-payroll/backend/Dockerfile` and reuses it for:

- FastAPI (`api`)
- Celery worker (`celery_worker`)
- Celery beat (`celery_beat`)

That is the **primary image** you build once, tag, and push to ECR (same image, different `command` / `args` in Kubernetes).

**Git-tracked manifests:** `ifms-payroll/deploy/kubernetes/` — Kustomize base (namespace, ConfigMap, API + Celery Deployments, Service). Edit `kustomization.yaml` → `images:` for your ECR repository URL. Create the Secret `ifms-payroll-app-secrets` from a local env file (never commit secrets); see `deploy/kubernetes/README.md` and `deploy/kubernetes/secret-env.example`. Optional ALB Ingress: `deploy/kubernetes/ingress-alb.yaml.example`.

You will **also** use:

- A public **Nginx** image (or a **small custom image** that only adds static files) for the React build.
- **Not** running Postgres/Valkey as cluster Pods in production if you adopt RDS + ElastiCache (recommended).

Optional components from compose (e.g. Superset, Flower) are **out of scope** for a minimal payroll deployment unless you explicitly add them; the SRS v4 product uses React dashboards, not Superset, for the main UI.

### 1.2 High-level AWS architecture

```
Internet → Route 53 → ALB (Ingress) → Nginx (static + /api proxy) → Service → Pods (API)
                                                              ↘ Celery worker / beat (same image)
RDS PostgreSQL  ←  TCP 5432 (security group)
ElastiCache     ←  TCP 6379 (Valkey-compatible Redis protocol)
ECR             ←  Images pushed from laptop
Secrets Manager / SSM  ←  DB passwords, JWT secret, Valkey password
```

---

## 2. Prerequisites

| Tool | Purpose |
|------|---------|
| Docker Desktop or Docker Engine | Build and tag images locally |
| AWS CLI v2 | ECR login, EKS, IAM |
| `kubectl` | Cluster access |
| `eksctl` (optional) | Create/manage EKS clusters |
| `helm` (optional) | Ingress controller, External Secrets |

**AWS permissions (minimum):** ECR push/pull, EKS describe/update, IAM pass role (if using IRSA), Secrets Manager or SSM read, RDS/ElastiCache security group rules from EKS nodes.

---

## 3. Create ECR repositories

Create one repository for the backend (and optionally one for the frontend/nginx bundle).

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecr create-repository --repository-name ifms-payroll-api --region "$AWS_REGION" 2>/dev/null || true
aws ecr create-repository --repository-name ifms-payroll-web --region "$AWS_REGION" 2>/dev/null || true
```

**Lifecycle policy** (optional): expire untagged or old images to save cost.

---

## 4. Build the application image on your laptop

From the repo root:

```bash
cd ifms-payroll/backend
docker build -t ifms-payroll-api:local .
```

Tag for ECR (replace account and region):

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

docker tag ifms-payroll-api:local \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ifms-payroll-api:v1.0.0"
```

### 4.1 Frontend static assets

Build the SPA and serve via Nginx in Kubernetes (either mount `dist/` from a **second** image or bake into an nginx-based image):

```bash
cd ifms-payroll/frontend
npm ci && npm run build
# dist/ is what Nginx should serve
```

Typical pattern: **Dockerfile.frontend** (you may add in repo) that `COPY dist/ /usr/share/nginx/html/` and your `nginx.conf` for `/api` proxy to the internal `api` Service.

---

## 5. Push image from laptop to ECR (online path)

Authenticate Docker to ECR:

```bash
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
```

Push:

```bash
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ifms-payroll-api:v1.0.0"
```

**EKS pulls this image** using an IAM role attached to worker nodes (ECR read) or IRSA on the Pod (recommended for least privilege).

---

## 6. Offline / “copy image” path (laptop → USB → bastion → ECR)

Use this when the laptop has **no direct push** to ECR or for audited transfers.

### 6.1 On the laptop

```bash
docker save ifms-payroll-api:local -o ifms-payroll-api.tar
# Securely copy ifms-payroll-api.tar to a host that can reach ECR (e.g. S3 + bastion, or encrypted disk)
```

### 6.2 On a host with AWS access

```bash
docker load -i ifms-payroll-api.tar
docker tag ifms-payroll-api:local \
  "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ifms-payroll-api:v1.0.0"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ifms-payroll-api:v1.0.0"
```

**Security:** Encrypt the tarball at rest; delete local copies after push; use short-lived credentials.

---

## 7. EKS cluster expectations

- **Kubernetes:** 1.28+ (verify with your org standard).
- **Node group:** Linux, sufficient CPU/RAM for API + Celery + Nginx (size for peak Celery concurrency).
- **Cluster add-ons:** VPC CNI, CoreDNS, kube-proxy; **AWS Load Balancer Controller** for ALB Ingress.
- **OIDC provider:** Enable if using IRSA for Pods.

Example (illustrative only; tune for your org):

```bash
eksctl create cluster \
  --name ifms-payroll-prod \
  --region "$AWS_REGION" \
  --nodegroup-name workers \
  --node-type m5.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 6 \
  --managed
```

---

## 8. Data plane on AWS (recommended)

### 8.1 Amazon RDS for PostgreSQL

- Engine: PostgreSQL **16** (aligns with project docs).
- Place RDS in **private subnets**; security group allows **only** EKS node SG (or cluster SG) on port **5432**.
- Create database `payroll_db` and application user `payroll_app` with least privilege; run **Alembic** migrations from a **Kubernetes Job** using the same image and `ALEMBIC_DATABASE_URL` (or admin URL) as in compose.

### 8.2 Amazon ElastiCache for Redis (Valkey-compatible client)

- Use **Redis** engine; Valkey protocol is Redis-compatible — configure `VALKEY_URL` / `CELERY_BROKER_URL` with TLS if using `rediss://` and ElastiCache in-transit encryption.
- Security group: allow EKS nodes → ElastiCache **6379** (or TLS port per engine).

### 8.3 Secrets

Store `DB_APP_PASS`, `DB_ROOT_PASS` (migration job only), `JWT_SECRET_KEY`, `VALKEY_PASS`, etc. in **AWS Secrets Manager**. Mount into Pods via:

- **External Secrets Operator** + SecretProviderClass, or
- CSI driver for Secrets Manager, or
- `kubectl create secret` from CI (less ideal).

Never commit production secrets to Git.

---

## 9. Kubernetes workloads (same image, different commands)

### 9.1 Environment variables (from compose → EKS)

Map compose `api` / `celery` env to Kubernetes:

| Variable | Source on AWS |
|----------|----------------|
| `DATABASE_URL` | RDS endpoint in Secret |
| `ALEMBIC_DATABASE_URL` | Admin URL Secret (Job only) |
| `VALKEY_URL`, `CELERY_BROKER_URL` | ElastiCache endpoint + auth Secret |
| `SECRET_KEY` | Secrets Manager |
| `UPLOAD_DIR`, `REPORTS_DIR` | `emptyDir` or **EFS** / **S3** (for multi-replica consistency, prefer S3 or EFS) |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `APP_DEBUG` | `false` |

Remove or ignore **Superset**-related env vars if not deploying Superset.

### 9.2 Example: API Deployment (snippet)

Use your ECR image and expose port **8000**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ifms-payroll-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ifms-payroll-api
  template:
    metadata:
      labels:
        app: ifms-payroll-api
    spec:
      containers:
        - name: api
          image: <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/ifms-payroll-api:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: ifms-payroll-app-secrets
          readinessProbe:
            httpGet:
              path: /docs
              port: 8000
            initialDelaySeconds: 10
          livenessProbe:
            httpGet:
              path: /docs
              port: 8000
```

### 9.3 Celery worker and beat

Same `image`, different `command`:

```yaml
command: ["celery", "-A", "app.celery_app", "worker", "--loglevel=info", "--concurrency=4"]
```

```yaml
command: ["celery", "-A", "app.celery_app", "beat", "--loglevel=info", "--scheduler=celery.beat:PersistentScheduler"]
```

Scale workers with **HPA** or a second Deployment with higher replicas.

### 9.4 Nginx + frontend

- Deployment with `nginx:1.25-alpine` (or custom image containing `dist/`).
- **ConfigMap** for `nginx.conf`: proxy `/api/` and `/api/v1/` to Service `ifms-payroll-api:8000`; serve static files for `/`.

### 9.5 Service and Ingress

- `Service` type **ClusterIP** for API and Nginx.
- **Ingress** with annotations for **AWS Load Balancer Controller** (ALB), TLS certificate in **ACM**, DNS in **Route 53**.
- Copy `ifms-payroll/deploy/kubernetes/ingress-alb.yaml.example` to a local file, set `host`, `certificate-arn`, and `subnets`, then `kubectl apply -f` (after the AWS Load Balancer Controller is installed on the cluster).

### 9.6 RDS and ElastiCache connectivity (security groups)

Pods resolve **RDS** and **ElastiCache** endpoints from `DATABASE_URL`, `VALKEY_URL`, and `CELERY_BROKER_URL` in the app Secret (same VPC or peered; no public RDS/ElastiCache endpoints in production).

| Direction | Rule |
|-----------|------|
| **EKS nodes → RDS** | RDS security group: inbound **TCP 5432** from the **EKS node security group** (or cluster security group, per your setup). |
| **EKS nodes → ElastiCache** | ElastiCache SG: inbound **TCP 6379** (or TLS port if enabled) from the **same** node SG. |
| **Outbound** | Node SG allows outbound to RDS/Elastiache SGs on those ports (often default “allow all outbound” on nodes). |

**Verify from a Pod** (after API Secret points at real endpoints):

```bash
kubectl run -n ifms-payroll netcheck --rm -it --image=curlimages/curl --restart=Never -- \
  curl -sS -o /dev/null -w "%{http_code}" http://ifms-payroll-api:8000/docs
# Expect: 200
```

For external HTTPS smoke test (after Ingress + ACM):

```bash
curl -sS -o /dev/null -w "%{http_code}" https://payroll.example.gov.la/docs
# Expect: 200
```

---

## 10. Database migrations

Run Alembic as a **Job** before or after deploy:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: ifms-payroll-migrate-once
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: <same ECR image>
          command: ["alembic", "upgrade", "head"]
          envFrom:
            - secretRef:
                name: ifms-payroll-app-secrets
```

Use admin DB URL only for this Job; restrict network and IAM.

---

## 11. Networking and security checklist

- [ ] RDS and ElastiCache in **private** subnets; **no** public ingress.
- [ ] EKS nodes can reach RDS/ElastiCache on required ports.
- [ ] ALB only exposes **443** (and **80** redirect if needed).
- [ ] Pod **securityContext**: non-root where possible; read-only root filesystem if supported.
- [ ] **Image scanning** in ECR on push; block critical CVEs in CI/CD.
- [ ] **IRSA** for Pods that call S3 or Secrets Manager (if applicable).

---

## 12. Observability

- **CloudWatch Container Insights** on EKS.
- Application logs: **Fluent Bit** → CloudWatch Logs, or OpenTelemetry sidecar (org standard).
- **Health endpoints:** align probes with real `/health` if added in FastAPI (otherwise `/docs` is a weak probe — prefer a dedicated health route in production).

---

## 13. Rollback

- Keep previous image tags in ECR (`v1.0.0`, `v0.9.0`).
- `kubectl rollout undo deployment/ifms-payroll-api`
- RDS: restore from snapshot only if migration failure requires it (test migrations in staging first).

---

## 14. Minimal command summary

```bash
# 1. Build
docker build -t ifms-payroll-api:local ./ifms-payroll/backend

# 2. Tag & push
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
docker tag ifms-payroll-api:local $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ifms-payroll-api:v1.0.0
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/ifms-payroll-api:v1.0.0

# 3. Apply manifests (after kubeconfig points to EKS)
cd ifms-payroll && kubectl apply -k deploy/kubernetes
```

---

## 15. Optional next steps in the repo

To make this repeatable in CI/CD, consider adding:

- `ifms-payroll/backend/Dockerfile` multi-stage (optional) and **image labels** (git SHA).
- `deploy/kubernetes/` — base Kustomize is in-repo; add overlays (`dev`, `prod`) as needed.
- GitHub Actions / CodePipeline: build on merge, push to ECR, `kubectl apply` or Argo CD.

---

*Document version 1.0 — IFMS Payroll — AWS EKS deployment from laptop-built images*
