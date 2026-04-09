# IFMS Payroll — Tech stack and third-party licenses

This document captures **direct** application dependencies and common **runtime/container** components used in this repository, with **license types as reported** by package metadata (`pip-licenses`, `license-checker`). It is for **engineering and compliance planning**, not legal advice.

---

## 1. Can we distribute “everything” (free or commercial) without license issues?

**No honest answer can guarantee “zero license challenge.”** Open-source and proprietary licenses impose **conditions** (attribution, notices, source availability for some copyleft, patent grants, trademark limits). Third parties can still disagree on interpretation or assert unrelated claims (patents, trademarks).

**In general terms for this stack:**

| License family | Typical commercial redistribution | Notes |
|----------------|-----------------------------------|--------|
| **MIT, BSD, ISC, Apache-2.0, PostgreSQL License** | Widely used in commercial products | Usually require **copyright + license notice** retention; Apache-2.0 often expects a **NOTICE** file if provided upstream. |
| **LGPL** (e.g. **psycopg2-binary**) | **Stricter**; obligations depend on how you link/distribute | Often reviewed by lawyers when shipping **binary** products; some teams switch to **psycopg2** built from source or document LGPL compliance. |
| **MPL-2.0** (some transitive deps, e.g. **certifi**, **orjson**) | Generally permissive with **file-level** copyleft for MPL’d files | Review if you modify MPL-covered files. |
| **Container images** (Debian, Alpine, Python, Node base images) | Usually fine with **attribution**; images bundle many packages | Generate an **SBOM** (Software Bill of Materials) for serious audits. |
| **Apache Superset** (Apache-2.0) | Generally commercial-friendly | Large dependency tree—still need **NOTICE**/attribution practices; **Apache** trademark rules apply to the name. |

**Practical steps before wide distribution**

1. **Ship a `THIRD_PARTY_NOTICES` or `NOTICE`** file aggregating required copyright lines (permissive licenses still require this).
2. **Generate full transitive lists** (SBOM): `pip-licenses`, `license-checker`, Syft, or similar—especially for **Docker images** and **Superset**.
3. **Resolve LGPL on `psycopg2-binary`** with your legal/compliance team if you distribute a closed binary that includes it.
4. **Do not** assume “MIT everywhere” in transitive trees—re-check **before** each release.

**Consult qualified legal counsel** for MoF / vendor / international distribution rules.

---

## 2. Backend (Python) — direct dependencies (`ifms-payroll/backend/requirements.txt`)

| Package | Version (pinned in file) | License (as reported by `pip-licenses`) |
|---------|--------------------------|----------------------------------------|
| fastapi | 0.111.0 | MIT |
| uvicorn | 0.29.0 | BSD-3-Clause |
| sqlalchemy | 2.0.30 | MIT |
| alembic | 1.13.1 | MIT |
| asyncpg | 0.29.0 | Apache-2.0 |
| psycopg2-binary | 2.9.9 | **LGPL** |
| pydantic | 2.7.0 | MIT |
| pydantic-settings | 2.2.1 | MIT |
| python-jose | 3.3.0 | MIT |
| passlib | 1.7.4 | BSD |
| bcrypt | 4.0.1 | Apache-2.0 |
| python-multipart | 0.0.9 | Apache-2.0 |
| celery | 5.4.0 | BSD |
| redis | 5.0.4 | MIT |
| openpyxl | 3.1.3 | MIT |
| weasyprint | 61.2 | BSD |
| pydyf | (range) | BSD |
| python-dateutil | 2.9.0 | Apache-2.0; BSD |
| httpx | 0.27.0 | BSD-3-Clause |
| pytest | 8.3.4 | MIT |

Transitive dependencies add more licenses (e.g. **cryptography** dual Apache/BSD, **certifi** MPL-2.0, **orjson** MPL with Apache/MIT). Regenerate with:

```bash
cd ifms-payroll/backend
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt pip-licenses
pip-licenses --from=mixed --format=markdown
```

---

## 3. Frontend (npm) — direct dependencies (`ifms-payroll/frontend/package.json`)

| Package | License (as reported by `license-checker`) | Scope |
|---------|---------------------------------------------|--------|
| ag-grid-community | MIT | runtime |
| ag-grid-react | MIT | runtime |
| @ant-design/icons | MIT | runtime |
| @hookform/resolvers | MIT | runtime |
| @superset-ui/embedded-sdk | Apache-2.0 | runtime |
| @tanstack/react-query | MIT | runtime |
| antd | MIT | runtime |
| axios | MIT | runtime |
| dayjs | MIT | runtime |
| i18next | MIT | runtime |
| i18next-http-backend | MIT | runtime |
| react | MIT | runtime |
| react-dom | MIT | runtime |
| react-hook-form | MIT | runtime |
| react-i18next | MIT | runtime |
| react-router-dom | MIT | runtime |
| recharts | MIT | runtime |
| xlsx | Apache-2.0 | runtime |
| zod | MIT | runtime |
| zustand | MIT | runtime |
| @types/node | MIT | dev |
| @types/react | MIT | dev |
| @types/react-dom | MIT | dev |
| @vitejs/plugin-react | MIT | dev |
| typescript | Apache-2.0 | dev |
| vite | MIT | dev |

**Note:** The `ifms-payroll-frontend` package is `private: true` and may show as **UNLICENSED** until you set an SPDX license in `package.json` for your own product.

Regenerate:

```bash
cd ifms-payroll/frontend
npx license-checker --json
```

---

## 4. Infrastructure / containers (`ifms-payroll/docker-compose.yml` and `Dockerfile`)

| Component | Role | Typical / stated license |
|-----------|------|---------------------------|
| python:3.12-slim | API / Celery image | Python **PSF**; Debian base—**many** underlying packages |
| node:20-alpine | Frontend build (`frontend_builder` profile) | Node.js + Alpine ecosystem |
| nginx:1.25-alpine | Reverse proxy | **BSD-2-Clause** (Nginx) |
| postgres:16-alpine | Database | **PostgreSQL License** |
| valkey/valkey:7.2-alpine | Cache / broker | **BSD-3-Clause** |
| apache/superset:4.0.0 | BI dashboards | **Apache-2.0** |
| mher/flower:2.0.1 | Celery UI | **MIT** |

---

## 5. Revision history

| Date | Change |
|------|--------|
| 2026-03-27 | Initial inventory from `requirements.txt`, `package.json`, `docker-compose.yml`, and automated license tools. |

---

*Regenerate license tables when dependencies change. For audit packs, attach machine-readable SBOM exports (CycloneDX/SPDX) alongside this document.*
