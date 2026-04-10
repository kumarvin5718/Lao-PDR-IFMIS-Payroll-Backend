# Day 11 — RDS, ElastiCache, Ingress, smoke test

This complements **`documents/IFMS_Payroll_AWS_EKS_Deployment.md`** §9.5–9.6.

## RDS + ElastiCache

1. Put **RDS** and **ElastiCache** in subnets reachable from the EKS cluster (same VPC or peering + routes).
2. **Security groups:** allow **EKS node SG → RDS SG** on **5432**; **node SG → ElastiCache SG** on **6379** (or your engine port).
3. Build `prod.env` for the Secret with:
   - `DATABASE_URL=postgresql+asyncpg://...@<rds-endpoint>:5432/payroll_db`
   - `VALKEY_URL` / `CELERY_BROKER_URL` using `<elasticache-endpoint>` and auth string.

## Ingress + TLS

1. Install [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/) on the cluster if not present.
2. Copy **`ingress-alb.yaml.example`** → edit `host`, `certificate-arn`, `subnets`.
3. `kubectl apply -f ingress-alb.yaml`
4. Point **Route 53** (or DNS) at the ALB hostname from `kubectl get ingress -n ifms-payroll`.

## Smoke tests

**In-cluster (no Ingress yet):**

```bash
kubectl run -n ifms-payroll netcheck --rm -it --image=curlimages/curl --restart=Never -- \
  curl -sS -o /dev/null -w "%{http_code}\n" http://ifms-payroll-api:8000/docs
```

**External (after Ingress + DNS):**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://YOUR_HOST/docs
```

Expect **200** for OpenAPI docs (same probe as Kubernetes readiness).
