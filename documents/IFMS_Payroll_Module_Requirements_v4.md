# IFMS Payroll Module — Software Requirements Document
### Lao PDR Government | Integrated Financial Management System
**Version:** 4.1 | **Date:** March 2026 | **Audience:** Development Team Only | **Status:** Active

> **Purpose:** This document is the single source of truth for development. It is intended for use in Cursor and other AI-assisted coding tools. All technology decisions are finalised — no open options remain. Business-level descriptions have been minimised in favour of technical specification.
>
> **This revision (4.x):** Role model uses **four roles** with ministry/location/department scoping via master tables (not ministry-only RLS). **Apache Superset** is not part of the delivery UI; reports and dashboards are **React + Recharts + FastAPI**. **Manager Master** and **Department Officer Master** map users to scope. Data input includes manual form, Excel bulk upload, and **online grid entry**. **Data ownership** rules govern edits after creation. **Employee export** (PDF/Excel) and **real-time duplicate detection** during bulk upload are required.
>
> **Phase 4.1 implementation notes:** Data ownership rules align with `_check_edit_permission` in `employee_service`. Manager / Dept Officer Master UIs include inactive rows, **Employees Tagged** / **Employees** columns, `GET /api/v1/master/employee-counts` (Valkey-cached). Dashboard: filter panel, scope stats cards, Recharts set. Online grid: AG Grid Community **version 33** + `ModuleRegistry`, bank/branch dependent dropdown, pinned name columns. Employee export and completeness trigger text align with Alembic `0003_phase4_role_model`. Open items OI-03 — OI-05 closed.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope](#2-scope)
3. [Technology Stack — Finalised](#3-technology-stack--finalised)
4. [User Roles and Login](#4-user-roles-and-login)
5. [Module Structure — Screens and Functionality](#5-module-structure--screens-and-functionality)
6. [Data Input Mediums](#6-data-input-mediums)
7. [Excel-Based Bulk Upload Feature](#7-excel-based-bulk-upload-feature)
8. [Calculation Logic — Detailed](#8-calculation-logic--detailed)
9. [Search Implementation](#9-search-implementation)
10. [Reports and Dashboards — React + Recharts](#10-reports-and-dashboards--react--recharts)
11. [Data Validation Rules](#11-data-validation-rules)
12. [Database Schema — Developer Detail](#12-database-schema--developer-detail)
13. [API Endpoints — Full Catalogue](#13-api-endpoints--full-catalogue)
14. [Internationalisation — English and Lao Script](#14-internationalisationi18n--english-and-lao-script)
15. [Data Archival Strategy](#15-data-archival-strategy)
16. [Deployment — Docker Production](#16-deployment--docker-production)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Error Codes and Handling](#18-error-codes-and-handling)
19. [Open Items](#19-open-items)

---


## 1. Executive Summary
The **Payroll Module** of the IFMS digitises the Lao PDR Government's Excel-based payroll toolkit (LaoPayrollToolkit_v5) into a web application backed by PostgreSQL. It covers civil servant payroll for 18 ministries and provincial administrations, implementing:

- MoF Circular No. 4904/MOF (December 2025) — salary structure
- SSO/MLSW Decree — social security (5.5% employee, 6% employer)
- GDT/MoF progressive Personal Income Tax — 6 brackets, 0–24%
- MoHA Gazette/Decree 292/GoL 2021 — remote/hazardous province classifications

All monetary values are in **Lao Kip (LAK)**. Phase 1 targets 500 employee records; schema supports 100,000+ for Phase 2 full civil service rollout.

---

## 2. Scope

**In scope:**

- Employee master data (manual form entry + Excel bulk upload + **online grid entry**)
- Monthly payroll calculation (basic salary, 12 standard allowances, 3 free allowance fields, SSO, PIT, 2 free deduction fields, net salary)
- 7 master lookup table management screens with full audit trail
- **Manager Master** — maps managers to location + department scope
- **Department Officer Master** — maps department officers to departments
- Role-based access control with ministry/location/department scoping (four roles)
- Bilingual UI — English and Lao script
- **Reports and dashboards via React + Recharts** (no embedded third-party BI tool in the delivery bundle)
- **Employee list export — PDF and Excel**
- **Real-time duplicate detection during bulk upload**
- **Data ownership rules — upload ownership and edit permissions**
- Data archival: active 3 years → archive indefinitely; retrieval on demand

**Not in the delivery bundle:**

- Apache Superset embedded dashboards (replaced by React-native reports as specified in §3 and §10)

**Out of Scope (Phase 1):**

- Pension / retirement benefit calculation
- Leave management
- Loan management (free-field deduction workaround is sufficient)
- Bank transfer file generation (account columns in schema; integration deferred)
- Integration with external systems (SSO portal, GDT tax, DigiLocker equivalent)

---

## 3. Technology Stack — Finalised

All components selected for **commercial-safe open-source licences** (Apache 2.0, MIT, BSD, PostgreSQL Licence). No AGPL, SSPL, or GPL components in the delivery bundle.

### 3.1 Licence Summary

| Component | Licence | Safe for Client Delivery |
|---|---|---|
| PostgreSQL 16 | PostgreSQL Licence (BSD-equivalent) | ✓ |
| FastAPI | MIT | ✓ |
| SQLAlchemy (ORM) | MIT | ✓ |
| Alembic | MIT | ✓ |
| React 18 | MIT | ✓ |
| Ant Design | MIT | ✓ |
| react-i18next | MIT | ✓ |
| Recharts | MIT | ✓ |
| AG Grid Community | MIT | ✓ |
| Valkey 7.2 | BSD 3-Clause | ✓ |
| Celery | BSD 3-Clause | ✓ |
| openpyxl | MIT | ✓ |
| WeasyPrint | BSD 3-Clause | ✓ |
| Nginx | BSD 2-Clause | ✓ |
| Docker Engine | Apache 2.0 | ✓ |
| pg_trgm (PostgreSQL extension) | PostgreSQL Licence | ✓ |
| pydantic | MIT | ✓ |
| python-jose (JWT) | MIT | ✓ |
| passlib (password hashing) | BSD | ✓ |

> **Note:** Apache Superset removed from v4.0. All analytical dashboards and reports are now React-native using Recharts and FastAPI aggregation endpoints.
>
> **Note on AG Grid:** AG Grid Community Edition (MIT) is added for the online grid entry feature (Option 3 data input). It provides spreadsheet-like editing with built-in virtualisation for large datasets.

### 3.2 Full Stack Decision Table

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Reverse Proxy** | Nginx | 1.25 (stable) | TLS termination, static asset serving, API proxy |
| **Frontend** | React + TypeScript | React 18, TS 5.x | Single-page application |
| **Frontend UI** | Ant Design | 5.x | Component library |
| **Frontend State / Data** | TanStack Query | v5 | Server-state management, caching, pagination |
| **Frontend Forms** | React Hook Form + Zod | Latest stable | Form state and schema validation |
| **Frontend Charts** | Recharts | 2.x | All dashboard and report charts |
| **Frontend Grid** | AG Grid Community | Latest stable (MIT) | Online spreadsheet entry (Option 3) |
| **Frontend i18n** | react-i18next | 14.x | Bilingual EN/Lao |
| **Frontend Excel preview** | SheetJS Community (xlsx) | Latest | Client-side parse of upload preview |
| **Backend API** | FastAPI | 0.111+ | REST API, async, OpenAPI auto-docs |
| **Backend ORM** | SQLAlchemy | 2.x (async) | Database access layer |
| **DB Migrations** | Alembic | 1.13+ | Version-controlled schema migrations |
| **Data Validation** | pydantic | v2 | Request/response schema validation |
| **Authentication** | python-jose + passlib | Latest | JWT (access + refresh), bcrypt |
| **Task Queue** | Celery | 5.x | Async payroll runs, bulk upload, report exports |
| **Task Broker** | Valkey 7.2 | 7.2 | Message broker for Celery; API cache backend |
| **Task Result Backend** | PostgreSQL (via SQLAlchemy) | — | Celery task results stored in DB |
| **Database** | PostgreSQL | 16 | Primary relational database |
| **Search** | pg_trgm + tsvector | Built into PG 16 | Full-text and trigram search |
| **Excel** | openpyxl | 3.x | Template generation + upload parsing + export |
| **PDF Generation** | WeasyPrint | 60+ | Payslips, employee list PDF export |
| **Container Runtime** | Docker Engine + Docker Compose | Docker 26+ | Development and production deployment |

---

## 4. User Roles and Login

### 4.1 Role definitions (four roles)

| Role Code | Display Name | Data Scope | Primary Use |
|---|---|---|---|
| `ROLE_EMPLOYEE` | Employee | Own record only | Self-service: view own data, add own record |
| `ROLE_MANAGER` | Manager | Assigned location + department | All screens except User Management and Audit Trail |
| `ROLE_DEPT_OFFICER` | Department Officer | Assigned department | Assign managers to employees/locations; limited data entry |
| `ROLE_ADMIN` | System Admin | All data, all ministries | All screens, all functions |

The application uses exactly the four roles in the table below (no separate HR, Finance, Auditor, or Ministry Head roles).

### 4.2 Permission Matrix

| Action | Employee | Manager | Dept Officer | Admin |
|---|---|---|---|---|
| View own employee record | ✓ | — | — | ✓ |
| Add employee (self) | ✓ | — | — | ✓ |
| View employee list (scoped) | ✗ | Own scope | Own dept | All |
| Add / Edit employee | Own only | Own scope | ✗ | All |
| Edit employee (ownership rule) | Own only | Tagged employees | ✗ | All |
| Deactivate employee | ✗ | Own scope | ✗ | All |
| Excel bulk upload | ✗ | ✓ | ✗ | ✓ |
| Online grid entry | ✓ | ✓ | ✗ | ✓ |
| Run Monthly Payroll | ✗ | ✗ | ✗ | ✓ |
| Edit Free Fields (Payroll) | ✗ | ✗ | ✗ | ✓ |
| Approve Payroll | ✗ | ✗ | ✗ | ✓ |
| Lock Payroll Month | ✗ | ✗ | ✗ | ✓ |
| Manage Lookup Tables | ✗ | ✗ | ✗ | ✓ |
| Manage Manager Master | ✗ | ✗ | ✓ | ✓ |
| Manage Dept Officer Master | ✗ | ✗ | ✗ | ✓ |
| Manage Users | ✗ | ✗ | ✗ | ✓ |
| View Reports / Dashboard | Own data | Own scope | Own dept | All |
| Export Reports (PDF/Excel) | Own data | Own scope | ✗ | All |
| View Audit Trail | ✗ | ✗ | ✗ | ✓ |
| View Archived Payroll | ✗ | ✗ | ✗ | ✓ |
| Trigger Archival | ✗ | ✗ | ✗ | ✓ |

### 4.3 Data Ownership Rules

These rules govern who can edit an employee record after it has been created. **Phase 4 implementation** (`_check_edit_permission` in `employee_service.py`) enforces the following:

| Actor | Can edit | Cannot edit |
|---|---|---|
| **ROLE_MANAGER** | Employees **in manager scope** (`service_province` + `department_name` match an active `manager_scope` row) where **either** (a) the record was **not** created by another manager (`owner_role != 'ROLE_MANAGER'`, e.g. employee-uploaded or admin-created), **or** (b) the record **was** uploaded by **this** manager (`uploaded_by_user_id == current_user.user_id`). | Any employee **outside** scope; records **uploaded by a different manager** (`owner_role == 'ROLE_MANAGER'` and `uploaded_by_user_id` ≠ current user). |
| **ROLE_EMPLOYEE** | **Own** record only: `uploaded_by_user_id == current_user.user_id`, **or** `employee.email` matches `app_user.email` for the logged-in user. | Any other employee record. |
| **ROLE_DEPT_OFFICER** | *(none)* | **All** employee records (create is also denied). |
| **ROLE_ADMIN** | All records (subject to normal validation). | — |

**Implementation columns on `employee`:**
- `uploaded_by_user_id UUID REFERENCES app_user(user_id)` — set at creation
- `owner_role VARCHAR(30)` — e.g. `'ROLE_EMPLOYEE'`, `'ROLE_MANAGER'`, `'ROLE_ADMIN'`

FastAPI `PUT /employees/{code}` calls `_check_edit_permission` before applying updates. Managers moving `service_province` / `department_name` must keep the employee within their assigned scope.

### 4.4 Scope Model (v4.0)

Manager and Department Officer scope is defined in the Manager Master and Department Officer Master tables (see §5.6 and §5.7), not in the JWT. The JWT carries only `role` and `user_id`. Scope is resolved at query time by joining to the scope tables.

### 4.5 Login Technical Specification

**Endpoint:** `POST /api/v1/auth/login`

**JWT Access Token Payload:**
```json
{
  "sub": "user_id_uuid",
  "role": "ROLE_MANAGER",
  "iat": 1700000000,
  "exp": 1700001800
}
```

> **Note:** `ministry_scope` removed from JWT in v4.0. Scope is resolved server-side from manager_scope / dept_officer_scope tables.

- Access token TTL: 30 minutes; stored in React memory
- Refresh token TTL: 8 hours; HTTP-only, Secure, SameSite=Strict cookie
- Failed login lockout: 5 consecutive failures → locked 15 minutes

---

## 5. Module Structure — Screens and Functionality

### 5.1 Employee Master

**Route:** `/employees`

#### 5.1.0 Visibility and access (four-role model)

- `ROLE_EMPLOYEE` sees only **Add Employee** (own record) — other list controls hidden where implemented.
- `ROLE_MANAGER` sees the full list **scoped** to assigned location + department (via `manager_scope`).
- **Add Employee** is visible to `ROLE_EMPLOYEE`, `ROLE_MANAGER`, and `ROLE_ADMIN`.
- Payroll module navigation is **hidden** for `ROLE_EMPLOYEE` and `ROLE_DEPT_OFFICER` where the product implements it.

#### 5.1.1 Employee List

- Server-side pagination: 50 rows/page; `GET /api/v1/employees?page=1&limit=50`
- Default sort: `employee_code ASC`
- Search bar: trigram + full-text search across employee_code, first_name, last_name, civil_service_card_id (see Section 9)
- Filter panel: Ministry (dropdown), Department (dependent dropdown), Grade (1–10), Employment Type, Province, Status (Active/Inactive)
- Columns: Employee Code, Full Name, Ministry, Department, Grade/Step, Position, Province, Employment Type, Status, Actions
- Actions per row: View (read-only form), Edit (editable form), Deactivate (soft-delete with confirm dialog)
- Bulk actions toolbar (appears when rows selected): Export to Excel, Bulk Deactivate
- Top-right buttons: **"Add Employee"** (opens form), **"Bulk Upload"** (opens upload modal)

#### 5.1.1a List actions — export

**Export button** (top-right, alongside "Add Employee"):

- **Export Excel** → `GET /api/v1/employees/export?format=xlsx` — see **§10.3** (sync ≤100 rows; async Celery >100)
- **Export PDF** → `GET /api/v1/employees/export?format=pdf` — WeasyPrint; max 1,000 rows; see **§10.3**

Export respects **current list filters** and **role scope**. `ROLE_EMPLOYEE` cannot export.



#### 5.1.2 Employee Form — Tabbed Layout

Single form, 8 tabs. Validation fires on tab navigation and on final "Save". All auto-derived fields are read-only inputs styled differently (grey background).

**Tab 1 — Personal Information**

| Field | DB Column | Data Type | Mandatory | Validation |
|---|---|---|---|---|
| Employee Code | `employee_code` | VARCHAR(10) | — | Auto-generated `LAO#####`; read-only; shown after first save |
| Title | `title` | ENUM | Yes | Mr. / Ms. / Mrs. / Dr. / Prof. |
| First Name | `first_name` | VARCHAR(80) | Yes | min 2 chars; alpha + space only |
| Last Name | `last_name` | VARCHAR(80) | Yes | min 2 chars |
| Gender | `gender` | ENUM | Yes | Male / Female |
| Date of Birth | `date_of_birth` | DATE | Yes | Age 18–70 |
| Email | `email` | VARCHAR(100) | Yes | Ends `@gov.la`; UNIQUE |
| Mobile Number | `mobile_number` | VARCHAR(20) | No | — |

**Tab 2 — Service Details**

| Field | DB Column | Data Type | Mandatory | Derived |
|---|---|---|---|---|
| Date of Joining Government | `date_of_joining` | DATE | Yes | ≥ DOB+18yrs; ≤ today |
| Years of Service | — | Computed | — | `DATEDIF(joining, today, YEAR)` — not stored in DB; computed at API response |
| Date of Retirement | — | Computed | — | `date_of_birth + 60 years` — not stored; computed at API |
| Employment Type | `employment_type` | ENUM | Yes | Permanent / Probationary / Contract / Intern |

**Tab 3 — Grade and Position**

| Field | DB Column | Derived | Notes |
|---|---|---|---|
| Position / Designation | `position_title` | No | Must match approved positions for the profession_category |
| Education Qualification | `education_level` | No | ENUM: 6 levels |
| Prior Experience Years | `prior_experience_years` | No | INT 0–40; nullable → treated as 0 |
| Grade | `grade` | ✓ GradeDerivation | Auto from education + experience |
| Step | `step` | ✓ GradeDerivation | Auto from education + experience |
| Position Level (Allowance) | `position_level` | ✓ Keyword match | Maps to LK_ALLOWANCE_RATES key |

**Position Level derivation function** (utility, used both in API and during bulk upload):
```python
def derive_position_level(position_title: str) -> str:
    t = position_title.lower()
    if "minister" in t and "deputy" not in t:   return "Position Allowance - Minister"
    if "deputy minister" in t:                   return "Position Allowance - Deputy Minister"
    if "director" in t and "deputy" not in t:    return "Position Allowance - Director"
    if "deputy director" in t:                   return "Position Allowance - Deputy Director"
    if "division chief" in t:                    return "Position Allowance - Division Chief"
    if "section chief" in t:                     return "Position Allowance - Section Chief"
    return "Position Allowance - General Staff"
```

**Tab 4 — Organisation** (cascading dropdowns)

| Field | DB Column | Source | Derived |
|---|---|---|---|
| Ministry | `ministry_name` | LK_ORG_MASTER | No |
| Department | `department_name` | Filtered by ministry | No |
| Division | `division_name` | Filtered by department | No |
| Profession Category | `profession_category` | LK_ORG_MASTER.profession_category | ✓ |
| Is NA Member | `is_na_member` | LK_ORG_MASTER.na_allowance_eligible | ✓ |
| Field Allowance Type | `field_allowance_type` | LK_ORG_MASTER.field_allowance_type | ✓ |

Cascade APIs:
- `GET /api/v1/lookups/departments?ministry_key=MOH`
- `GET /api/v1/lookups/divisions?dept_key=MOH_CUR`
- `GET /api/v1/lookups/org-derived?ministry_name=Ministry+of+Health+(MoH)` → `{profession_category, is_na_member, field_allowance_type}`

**Tab 5 — Service Location** (cascading dropdowns)

| Field | DB Column | Source | Derived |
|---|---|---|---|
| Service Country | `service_country` | ENUM: Lao PDR / Foreign / International | No |
| Service Province / Posting | `service_province` | LK_LOCATION_MASTER | No |
| Service District | `service_district` | Filtered by province | No |
| Is Remote Area | `is_remote_area` | LK_LOCATION_MASTER.is_remote | ✓ |
| Is Foreign Posting | `is_foreign_posting` | `service_country = 'Foreign / International'` | ✓ |
| Is Hazardous Area | `is_hazardous_area` | LK_LOCATION_MASTER.is_hazardous | ✓ |
| Residential Address | `house_no`, `street`, `area_baan`, `province_of_residence`, `pin_code`, `residence_country` | Manual | No |

Cascade APIs:
- `GET /api/v1/lookups/provinces?country_key=LAO`
- `GET /api/v1/lookups/districts?province_key=VTE`
- `GET /api/v1/lookups/location-derived?province=Vientiane+Capital` → `{is_remote, is_hazardous}`

**Tab 6 — Bank Details** (cascading dropdowns)

| Field | DB Column | Source | Derived |
|---|---|---|---|
| Bank Name | `bank_name` | LK_BANK_MASTER | No |
| Bank Branch | `bank_branch` | Filtered by bank | No |
| Bank Branch Code | `bank_branch_code` | LK_BANK_MASTER.branch_code | ✓ |
| Bank Account Number | `bank_account_no` | Manual | No |
| SWIFT / BIC Code | `swift_code` | LK_BANK_MASTER.swift_code | ✓ |

Cascade API: `GET /api/v1/lookups/branches?bank_key=BCEL`

**Tab 7 — Payroll Flags**

| Field | DB Column | Type | Mandatory |
|---|---|---|---|
| Has Spouse | `has_spouse` | BOOLEAN | Yes (default false) |
| No. of Eligible Children | `eligible_children` | INT 0–3 | Yes (default 0) |

**Tab 8 — Identity Documents**

| Field | DB Column | Validation |
|---|---|---|
| Civil Service Card ID | `civil_service_card_id` | `^CSC\d{6}$`; UNIQUE; NOT NULL |
| SSO Number | `sso_number` | `^SSO\d{7}$`; UNIQUE when not null |

**Employee CRUD endpoints:**
```
GET    /api/v1/employees                     List + filters + pagination
POST   /api/v1/employees                     Create new employee
GET    /api/v1/employees/{employee_code}     Get single record
PUT    /api/v1/employees/{employee_code}     Full update
PATCH  /api/v1/employees/{employee_code}     Partial update
DELETE /api/v1/employees/{employee_code}     Soft-delete (is_active = false)
```

**Employee code auto-generation:**
```python
SELECT MAX(CAST(SUBSTRING(employee_code, 4) AS INT)) FROM employee
# next_seq = max_seq + 1; format: f"LAO{next_seq:05d}"
# Use SELECT FOR UPDATE to prevent race conditions during concurrent inserts
```

---

### 5.2 Payroll Calculation — Monthly Run

**Route:** `/payroll/monthly`

> **Visibility:** Hidden from sidebar for `ROLE_EMPLOYEE` and `ROLE_DEPT_OFFICER`.

#### 5.2.1 Screen Controls

- Month/Year picker — cannot select future months
- Ministry filter (scoped per server-side filters (Admin sees all; others per §4))
- "Run Payroll" button → `POST /api/v1/payroll/run`
- "Approve Month" button (Admin only in the four-role permission model) → sets `approval_status = 'APPROVED'`
- "Lock Month" button (Admin only) → sets `is_locked = true` for all records in month; payroll must be `APPROVED` first
- "Unlock Month" (Admin only, with mandatory reason field)

#### 5.2.2 Payroll State Machine

```
PENDING → APPROVED → LOCKED → (ARCHIVED after 3 years)
```

- Only LOCKED months are eligible for archival
- Approved but not yet locked months cannot be re-run unless unlocked by Admin

#### 5.2.3 Async Payroll Run

```
POST /api/v1/payroll/run
  Body: { "month": "2026-03", "ministry_filter": null }
  Response: { "job_id": "uuid", "status": "queued" }

GET /api/v1/payroll/jobs/{job_id}   (poll every 3 seconds)
  Response: { "status": "running|done|failed", "records_processed": 450, "errors": [] }
```

Celery worker logic:
1. Fetch all `is_active = true` employees (filtered by ministry if provided)
2. For each employee, run full calculation (see Section 8)
3. UPSERT into `payroll_monthly` using `ON CONFLICT (employee_code, payroll_month) DO UPDATE`
4. Reject upsert if `is_locked = true` for that month; add to `errors` list
5. Write job result to `celery_task_result` table

#### 5.2.4 Payroll Register Grid

Frozen columns: Employee Code, Full Name, Ministry.
All formula columns are read-only.
Free-field columns (Other Allowance 1/2/3, Additional Deduction 1/2) are inline-editable by ROLE_ADMIN.

Columns in order:
`employee_code | full_name | ministry | grade | step | basic_salary | position_allowance | years_service_allowance | teaching_allowance | medical_allowance | na_allowance | hazardous_allowance | remote_allowance | foreign_allowance | fuel_benefit | spouse_benefit | child_benefit | other_allowance_1 (editable + desc) | other_allowance_2 (editable + desc) | other_allowance_3 (editable + desc) | total_allowances | gross_earnings | sso_contribution | taxable_income | pit_amount | addl_deduction_1 (editable + desc) | addl_deduction_2 (editable + desc) | total_deductions | NET SALARY`

Grand totals row pinned at bottom.

---

### 5.3 Master Data Management — 7 Lookup Tables

**Access:** `ROLE_ADMIN` only for master data write operations (lookup maintenance).



All screens share the same layout pattern:
- Filterable/searchable table
- Inline edit for value columns (amounts, rates, flags)
- Key columns (Ministry Key, Province Key, Bank Key, Allowance Name) rendered as read-only badges after creation
- "Add Row" button for extensible tables (Org, Location, Bank)
- On every save: modal requiring Circular/Reference and Change Remarks fields (both mandatory)
- Audit trail sidebar: collapsible panel showing last 10 changes for the selected row

**Routes:**

| Screen | Route | Table |
|---|---|---|
| Grade & Step Rates | `/master/grade-step` | lk_grade_step |
| Allowance Rates | `/master/allowance-rates` | lk_allowance_rates |
| Grade Derivation Rules | `/master/grade-derivation` | lk_grade_derivation |
| Organisation Master | `/master/org` | lk_org_master |
| Location Master | `/master/location` | lk_location_master |
| Bank Master | `/master/bank` | lk_bank_master |
| PIT Brackets | `/master/pit-brackets` | lk_pit_brackets |

**Valkey cache strategy:**

Each lookup table is cached under key `master:{table_name}` with TTL 24 hours.
On every PUT or POST to a master table:
```python
await valkey.delete(f"master:{table_name}")
```
FastAPI startup: warm all 7 caches. Cache miss: query PostgreSQL, re-populate cache.

---

### 5.4 User Management

**Access:** `ROLE_ADMIN` only.



**Route:** `/admin/users` (ROLE_ADMIN only)

User table: see **§12.0.3** (`app_user`).

- List: username, full name, role, ministry scope, last login, active status
- Create: username, auto-generated temp password (emailed), role, scope fields as applicable to the assigned role
- Edit: role, ministry scope, active/inactive
- Reset password: generates new temp password; user must change on next login (`force_password_change = true`)
- Login history: last 30 entries per user

---

### 5.5 Audit Trail Viewer

**Access:** `ROLE_ADMIN` only (managers do not have audit access).



**Route:** `/audit`

Backed by centralised `audit_log` table (populated by PostgreSQL triggers on all LK_ tables).

Filter controls: Table name (dropdown), Date range, Changed by (user search), Circular reference (text search).

Columns: Table | Row Key | Field Changed | Old Value | New Value | Changed By | Changed At | Circular Ref | Remarks

Pagination: 100 rows/page server-side. Export to Excel: max 50,000 rows per export via Celery async job.

---

### 5.6 Manager Master (NEW in v4.0)

**Route:** `/master/managers`
**Access:** ROLE_DEPT_OFFICER (create/edit within own dept), ROLE_ADMIN (all)

#### 5.6.1 Purpose

Maps `app_user` records with `ROLE_MANAGER` to their data scope: one or more combinations of location (province) + department. A manager can have multiple scope rows (e.g. manages Vientiane Capital + MoH, and also Sekong + MoH).

#### 5.6.2 Screen Layout

- List: Manager Name | Username | Location | Department | **Employees Tagged** | Active | Actions
- **Employees Tagged:** count of **active** employees whose `service_province` and `department_name` match that scope row; sourced from `GET /api/v1/master/employee-counts` (`by_manager_scope` keys: `{service_province}||{department_name}`), Valkey-cached 300s on the API.
- **Show:** **All** | **Active only** (default **Active only**) — client-side filter on `is_active`.
- **Edit** is available on **every** row, including **inactive** (soft-deleted) scope rows, to allow reactivation by saving (delete + recreate flow).
- **Remove** is shown only when `is_active === true` (inactive rows cannot be “removed” again).
- "Add Manager Scope" button → drawer form
- Edit/Remove scope per manager (as above)

#### 5.6.3 DB Table

```sql
CREATE TABLE manager_scope (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  location        VARCHAR(60)  NOT NULL REFERENCES lk_location_master(province),
  department_name VARCHAR(80)  NOT NULL REFERENCES lk_org_master(department_name),
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMP    NOT NULL DEFAULT now(),
  created_by      VARCHAR(80)  NOT NULL,
  UNIQUE (user_id, location, department_name)
);
CREATE INDEX idx_manager_scope_user ON manager_scope(user_id);
```

#### 5.6.4 API Endpoints

```
GET    /api/v1/master/manager-scope              ROLE_ADMIN, ROLE_DEPT_OFFICER
POST   /api/v1/master/manager-scope              ROLE_ADMIN, ROLE_DEPT_OFFICER
DELETE /api/v1/master/manager-scope/{id}         ROLE_ADMIN, ROLE_DEPT_OFFICER
GET    /api/v1/master/manager-scope/my-scope     ROLE_MANAGER — returns own scope
```

### 5.7 Department Officer Master (NEW in v4.0)

**Route:** `/master/dept-officers`
**Access:** ROLE_ADMIN only

#### 5.7.0 Screen layout (Phase 4)

- List: Officer Name | Username | Department | **Employees** | Active | Actions
- **Employees:** count of **active** employees with `department_name` equal to the row’s department; sourced from `GET /api/v1/master/employee-counts` (`by_department`).
- **Edit** on **all** rows including **inactive**; **Remove** only when `is_active === true`.
- **Show:** **All** | **Active only** (default **Active only**).

#### 5.7.1 Purpose

Maps `app_user` records with `ROLE_DEPT_OFFICER` to their assigned departments. Department Officers can create/manage manager scope assignments within their departments.

#### 5.7.2 DB Table

```sql
CREATE TABLE dept_officer_scope (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  department_name VARCHAR(80)  NOT NULL REFERENCES lk_org_master(department_name),
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMP    NOT NULL DEFAULT now(),
  created_by      VARCHAR(80)  NOT NULL,
  UNIQUE (user_id, department_name)
);
CREATE INDEX idx_dept_officer_scope_user ON dept_officer_scope(user_id);
```

#### 5.7.3 API Endpoints

```
GET    /api/v1/master/dept-officer-scope         ROLE_ADMIN
POST   /api/v1/master/dept-officer-scope         ROLE_ADMIN
DELETE /api/v1/master/dept-officer-scope/{id}    ROLE_ADMIN
```

### 5.8 Dashboard (React-native, replaces Superset in v4.0)

**Route:** `/dashboard`
**Access:** All authenticated roles (metrics and charts **scoped** by role on the server)

**Phase 4 UI (implemented):**

- **Top row — KPI cards (Ant Design `Statistic`):** Total Employees; Data Complete (manager/admin); Pending Registrations (clickable to registrations, manager/admin); Gross / Net payroll (admin only). Role flags hide cards not applicable to the user.
- **Filter panel (`Card` — “Filter panel”):** independent **Select** dropdowns — **Department**, **Location** (province; manager + admin), **Manager** (admin, dept officer, and manager sees self-only). Clearing a filter clears its selection.
- **Per-filter scope stats:** when Department, Location, or Manager is selected, a **scope stats** card appears below that dropdown showing **Total in scope**, a **Progress** bar (**fill rate %**), and **filled vs pending** counts (`ScopeStatCard` + `useDeptStats` / `useLocationStats` / `useManagerStats`).
- **Charts (Recharts):** **Data completeness by department** — stacked horizontal bars (complete vs incomplete); **Employment type mix** — pie chart; **Payroll trend** (admin) — composed chart (gross/net in LAK millions + headcount); **Grade distribution** — bar chart with counts. No separate “headcount by location” bar chart in the current build — location drill-down is via the filter + scope card.

See Section 10 for API and data details.

### 5.9 Self-Registration Screen (NEW in v4.0)

**Route:** `/register` (public — no login required)

**Fields:**

- SSO Number (VARCHAR 12, pattern `^SSO\d{7}$`, unique)
- Full Name (VARCHAR 120, mandatory)
- Email (VARCHAR 120, must end `@gov.la`, unique)
- Phone Number (VARCHAR 20, optional)
- Location / Province (dropdown from `lk_location_master`, mandatory)
- Department (dependent dropdown filtered by location, mandatory)

**On submit:** `POST /api/v1/auth/register`

**Success:** redirect to `/register/success` page with message: *"Your registration has been submitted. Your manager will review and activate your account."*

**Duplicate SSO / email:** show inline error before submit (`GET /api/v1/employees/check-duplicate?field=sso_number&value=...`).

### 5.10 Pending Registrations Screen (NEW in v4.0)

**Route:** `/admin/registrations`

**Access:** `ROLE_MANAGER` (own scope only), `ROLE_ADMIN` (all)

**List:** Full Name | Email | SSO | Location | Department | Submitted At | Status

**Actions:** Approve | Reject (with optional rejection reason)

**On Approve:** `app_user.registration_status` = `ACTIVE`, `employee.is_active` = `true`; user receives in-app notification on next login.

**On Reject:** `app_user.registration_status` = `REJECTED`; employee stub remains but `is_active` = `false`.

---

## 6. Data Input Mediums

Three methods exist for entering employee data. All methods write to the same `employee` table and enforce the same validation rules.

### 6.1 Option 1 — Web Form (All roles)

Standard 8-tab employee form at `/employees/new`. Available to ROLE_EMPLOYEE (own record only), ROLE_MANAGER (scoped), ROLE_ADMIN (all).

### 6.2 Option 2 — Excel Bulk Upload (Manager + Admin)

Download template → fill offline → upload → validate → confirm. See Section 7 for full specification. Available to ROLE_MANAGER and ROLE_ADMIN only.

### 6.3 Option 3 — Online Grid Entry (Employee + Manager + Admin)

**Route:** `/employees/grid-entry`

A spreadsheet-like grid (**AG Grid Community v33.x**, MIT licence) rendered in the browser. The app registers **`AllCommunityModule`** via **`ModuleRegistry.registerModules`** (required for AG Grid v33+). Users enter multiple employee records directly in the grid without downloading a file.

#### 6.3.1 Grid Behaviour

- Columns match the employee form fields (same validation rules apply)
- **Pinned columns (left):** **Title**, **First Name**, **Last Name** — remain visible during horizontal scroll.
- Dependent dropdowns: **Ministry** → **Department** (options depend on ministry); **Province** (location list); **Bank Name** → **Bank Branch** — branch `Select` options are **filtered by selected bank** (`bank_name` match); if no bank selected, branch shows placeholder.
- **Real-time duplicate detection (per field):** debounced **GET** `/api/v1/employees/check-duplicate` when values change for fields such as **email**, **civil_service_card_id**, **bank_account_no**, **employee_code** (and related) — duplicate sets an inline error on the row and clears when unique.
- Duplicate indicator: cell styling / row error state with message (e.g. existing employee code)
- Row **Status** column (`_status`, **pinned right**): reflects valid vs error state
- **Submit:** valid rows POSTed via batch API; **server validation errors** are shown in an **inline error table** (expandable) with field-level messages and hints where applicable
- **Success:** **toast** listing **created employee codes** (and counts)
- "Submit" processes submitted rows; **maximum 200 rows** per grid session

#### 6.3.2 Duplicate Check API

```
GET /api/v1/employees/check-duplicate?field=email&value=x@gov.la
Response: { "is_duplicate": true, "existing_code": "LAO00042" }

Fields supported: email, civil_service_card_id, bank_account_no, employee_code
```

Response time target: < 200ms (served from Valkey cache where possible).

#### 6.3.3 Ownership

Records created via Option 3 set `uploaded_by_user_id = current_user.user_id` and `owner_role = current_user.role`.

---


## 7. Excel-Based Bulk Upload Feature

### 7.1 Two Upload Types

| Type | Template Endpoint | Who Can Use | Purpose |
|---|---|---|---|
| Employee Bulk Upload | `GET /api/v1/bulk-upload/employee/template` | ROLE_MANAGER, ROLE_ADMIN | Insert new or update existing employees |
| Payroll Free-Fields Upload | `GET /api/v1/bulk-upload/payroll-free-fields/template?month=2026-03` | ROLE_ADMIN | Bulk-enter Other Allowances and Additional Deductions for a month |

### 7.2 Employee Upload Template Structure

File format: `.xlsx` only. Max size: 10MB.

**Sheets in generated template:**

| Sheet Name | Content | Protected |
|---|---|---|
| `EMPLOYEE_DATA` | Main entry sheet; one row per employee | No |
| `INSTRUCTIONS` | Colour legend, column descriptions, rules | Yes (read-only) |
| `SAMPLE_DATA` | 3 pre-filled sample rows from existing data | No |
| `REF_MINISTRY` | All valid ministry names from lk_org_master | Yes |
| `REF_PROVINCE` | All valid province names from lk_location_master | Yes |
| `REF_BANK` | All valid bank names from lk_bank_master | Yes |
| `REF_GRADE_DERIVATION` | Education × Experience → Grade/Step reference table | Yes |

REF_ sheets are populated **at template download time** with live data from the database so dropdowns always reflect current master data. Template is never cached as a static file.

**EMPLOYEE_DATA columns:**

| Col | Header | Mandatory | Cell Type | Notes |
|---|---|---|---|---|
| A | Employee Code | No | Text | Blank = new employee; `LAO#####` = update existing |
| B | Title | Yes | Dropdown | `=REF_TITLE` named range |
| C | First Name | Yes | Text | |
| D | Last Name | Yes | Text | |
| E | Gender | Yes | Dropdown | Male / Female |
| F | Date of Birth | Yes | Date | DD-MMM-YYYY |
| G | Email | Yes | Text | Must end `@gov.la` |
| H | Mobile Number | No | Text | |
| I | Date of Joining Government | Yes | Date | DD-MMM-YYYY |
| J | Employment Type | Yes | Dropdown | Permanent / Probationary / Contract / Intern |
| K | Position / Designation | Yes | Text | |
| L | Education Qualification | Yes | Dropdown | `=REF_EDUCATION` named range |
| M | Prior Experience Years | No | Number | 0–40 |
| N | Civil Service Card ID | Yes | Text | CSC000001 format |
| O | SSO Number | No | Text | SSO1234567 format |
| P | Ministry / Province / Org | Yes | Dropdown | `=REF_MINISTRY` named range |
| Q | Department Name | Yes | Text | Must match a valid dept for the selected ministry |
| R | Division Name | No | Text | |
| S | Service Country | Yes | Dropdown | Lao PDR / Foreign / International |
| T | Service Province / Posting | Yes | Text | Must match REF_PROVINCE |
| U | Service District | No | Text | |
| V | House No. | No | Text | |
| W | Street | No | Text | |
| X | Area / Baan | No | Text | |
| Y | Province of Residence | No | Text | |
| Z | PIN Code | No | Text | |
| AA | Bank Name | Yes | Dropdown | `=REF_BANK` named range |
| AB | Bank Branch | Yes | Text | Must match a valid branch for selected bank |
| AC | Bank Account Number | Yes | Number | 9–12 digits |
| AD | Has Spouse | Yes | Dropdown | Yes / No |
| AE | No. of Eligible Children | Yes | Number | 0–3 |

Template formatting rules (applied via openpyxl at generation time):
- Row 1: Column headers, bold, light blue fill (`#BDD7EE`)
- Row 2: Helper text / hint per column, italic, light grey fill (`#F2F2F2`)
- Row 3–5: Sample data rows, light yellow fill (`#FFFACD`)
- Row 6+: Empty data rows, white
- Mandatory column headers marked with `*`
- Column A header includes note: `"Leave blank for new employees. Enter LAO##### to update an existing record."`

### 7.3 Upload Flow (Frontend + Backend)

```
1. User: GET /api/v1/bulk-upload/employee/template
        → Downloads dynamically generated XLSX

2. User fills template offline

3. User: Opens "Bulk Upload" modal on /employees
        → Drags/drops or selects file (.xlsx only, max 10MB)

4. Frontend: Reads first 5 rows via SheetJS for immediate preview
             Sends file to: POST /api/v1/bulk-upload/employee/validate
             (multipart/form-data)

5. Backend (FastAPI + Celery):
   a. Save uploaded file to /app/uploads/{session_id}/original.xlsx
   b. Parse all rows with openpyxl
   c. For each row: run all validations; run auto-derivations
   d. Build result: { valid: [...], warnings: [...], errors: [...] }
   e. Store parsed rows in upload_session_rows table (or Valkey with TTL 30min)
   f. Return: {
        session_id: "uuid",
        total_rows: 120,
        valid_rows: 115,
        warning_rows: 3,
        error_rows: 2,
        preview: [first 10 rows with status],
        errors: [{row: 5, column: "G", message: "Email must end in @gov.la"}]
      }

6. Frontend: Shows Upload Preview Table
   - Green row badge: "Valid"
   - Yellow row badge: "Warning"
   - Red row badge: "Error — will be skipped"
   - "Download Error Report" button (GET /api/v1/bulk-upload/employee/error-report/{session_id})
     → Returns same XLSX with extra column "VALIDATION_RESULT" appended

7. User reviews; optionally downloads and corrects errors; re-uploads

8. User: POST /api/v1/bulk-upload/employee/confirm { "session_id": "uuid" }

9. Backend:
   a. Validate session not expired (30 min TTL)
   b. Commit all valid + warning rows to employee table
   c. Skip error rows
   d. Set session status = 'CONFIRMED'
   e. Return: { imported: 118, skipped: 2, employee_codes: [...newly created codes...] }
```

### 7.4 Insert vs Update Logic

```python
if row["employee_code"] is None or row["employee_code"] == "":
    # New employee: auto-generate code; INSERT
else:
    employee = db.get(Employee, row["employee_code"])
    if employee is None:
        raise UploadRowError("ERR_EMP_CODE_NOT_FOUND", row=row_number)
    # Update: UPDATE employee SET ... WHERE employee_code = X
```

### 7.5 Upload Session Table

```sql
CREATE TABLE upload_session (
  session_id     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_type    VARCHAR(30)  NOT NULL,     -- 'EMPLOYEE' | 'PAYROLL_FREE_FIELDS'
  uploaded_by    VARCHAR(80)  NOT NULL,
  uploaded_at    TIMESTAMP    NOT NULL DEFAULT now(),
  file_path      VARCHAR(500),              -- path in /app/uploads/
  status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING|CONFIRMED|EXPIRED
  total_rows     INT,
  valid_rows     INT,
  warning_rows   INT,
  error_rows     INT,
  expires_at     TIMESTAMP    NOT NULL      -- uploaded_at + 30 minutes
);

CREATE TABLE upload_session_rows (
  id             BIGSERIAL    PRIMARY KEY,
  session_id     UUID         NOT NULL REFERENCES upload_session(session_id) ON DELETE CASCADE,
  row_number     INT          NOT NULL,
  row_data       JSONB        NOT NULL,     -- parsed row as JSON
  status         VARCHAR(10)  NOT NULL,     -- 'valid'|'warning'|'error'
  messages       JSONB                      -- [{column, message}]
);
```

Cleanup job (Celery beat, every hour): `DELETE FROM upload_session WHERE expires_at < now()` — cascades to rows; deletes file from filesystem.

### 7.6 Payroll Free-Fields Upload

Template endpoint: `GET /api/v1/bulk-upload/payroll-free-fields/template?month=2026-03`

Backend pre-fills Employee Code and Employee Name for all active employees. User fills amount and description columns.

**Template columns:** Employee Code (locked) | Employee Name (locked) | Other Allowance 1 Amount | Other Allowance 1 Description | Other Allowance 2 Amount | Other Allowance 2 Description | Other Allowance 3 Amount | Other Allowance 3 Description | Additional Deduction 1 Amount | Additional Deduction 1 Description | Additional Deduction 2 Amount | Additional Deduction 2 Description

Validations: Employee code exists; amounts ≥ 0 (null treated as 0); month not locked; no duplicate employee codes in file.

---


### 7.7 Real-time Duplicate Detection During Upload Validation

When the backend processes an uploaded file (step 5 of the upload flow), duplicate detection is **field-level** and **cross-row**:

1. **Cross-row duplicates within the file**: if two rows in the same upload have the same email, CSC ID, or bank account — both rows flagged as errors
2. **Cross-database duplicates**: each row's email, CSC ID, bank_account_no checked against existing `employee` table rows — conflict flagged per field with the existing employee code

The validation response includes per-row, per-field duplicate detail:

```json
{
  "row": 5,
  "column": "email",
  "message": "Duplicate: already used by LAO00042",
  "type": "error"
}
```

### 7.8 Ownership on Bulk Upload

Records created via bulk upload set:

- `uploaded_by_user_id = current_user.user_id`
- `owner_role = current_user.role`


---

## 8. Calculation Logic — Detailed

All calculation functions live in `app/services/payroll_calculator.py`. They are pure functions with no database I/O — all lookup data is passed in as parameters pre-fetched from Valkey cache or DB.

### 8.1 Grade Derivation

```python
def derive_grade_step(
    education_level: str,
    prior_experience_years: int,
    derivation_table: list[GradeDerivationRow]
) -> tuple[int, int]:
    exp = prior_experience_years or 0
    for row in derivation_table:
        if row.education_level == education_level \
           and row.exp_min_years <= exp <= row.exp_max_years:
            return (row.derived_grade, row.derived_step)
    return (1, 1)  # fallback: no match found
```

### 8.2 Basic Salary

```python
def calculate_basic_salary(
    grade: int, step: int,
    grade_step_table: dict[str, GradeStepRow],
    salary_index_rate: Decimal
) -> Decimal:
    key = f"G{grade:02d}-S{step:02d}"
    row = grade_step_table[key]
    return Decimal(round(row.grade_step_index * salary_index_rate, 0))
```

`salary_index_rate` = value of `LK_ALLOWANCE_RATES` where `allowance_name = 'Salary Index Rate (ຄ່າດັດສະນີ — LAK per Index Point)'`. Currently `10000`.

### 8.3 Position Allowance

```python
def calc_position_allowance(position_level: str, rates: dict) -> Decimal:
    return Decimal(rates.get(position_level, 0))
    # rates dict keyed by allowance_name from lk_allowance_rates
```

### 8.4 Years of Service Allowance

```python
def calc_years_service_allowance(
    date_of_joining: date,
    payroll_month: date,
    rates: dict
) -> Decimal:
    years = relativedelta(payroll_month, date_of_joining).years
    if years <= 0:   return Decimal(0)
    if years <= 5:   return Decimal(years * int(rates["Years of Service Rate — 1 to 5 Years (LAK/year)"]))
    if years <= 15:  return Decimal(years * int(rates["Years of Service Rate — 6 to 15 Years (LAK/year)"]))
    if years <= 25:  return Decimal(years * int(rates["Years of Service Rate — 16 to 25 Years (LAK/year)"]))
    return Decimal(years * int(rates["Years of Service Rate — 26+ Years (LAK/year)"]))
```

`years` computed against `payroll_month` (first day of the month being processed), not `today`, to ensure reproducibility of historical runs.

### 8.5 Teaching Allowance

```python
def calc_teaching_allowance(field_allowance_type: str, basic_salary: Decimal, rates: dict) -> Decimal:
    if field_allowance_type == "Teaching":
        rate = Decimal(str(rates["Teaching Allowance Rate — % of Basic Salary"]))  # 0.20
        return Decimal(round(basic_salary * rate, 0))
    return Decimal(0)
```

### 8.6 Remote Area Allowance

```python
def calc_remote_allowance(is_remote_area: bool, basic_salary: Decimal, rates: dict) -> Decimal:
    if is_remote_area:
        rate = Decimal(str(rates["Remote / Difficult Area Allowance Rate — % of Basic Salary"]))  # 0.25
        return Decimal(round(basic_salary * rate, 0))
    return Decimal(0)
```

### 8.7 Remaining Flat-Rate Allowances

```python
medical_allowance  = Decimal(rates["Medical Personnel Allowance"]) if field_allowance_type == "Medical" else Decimal(0)
na_allowance       = Decimal(rates["National Assembly (NA) Member Allowance"]) if is_na_member else Decimal(0)
hazardous_allow    = Decimal(rates["Hardship and Hazardous Jobs Allowance"]) if is_hazardous_area else Decimal(0)
foreign_allow      = Decimal(rates["Foreign Representative Living Allowance (LAK equivalent)"]) if is_foreign_posting else Decimal(0)
fuel_benefit       = Decimal(rates["Fuel Benefit — High Ranking Officials (Grade 6)"]) if grade == 6 else Decimal(0)
spouse_benefit     = Decimal(rates["Spouse Benefit"]) if has_spouse else Decimal(0)
child_benefit      = Decimal(rates["Child Benefit (per child, max 3)"]) * min(eligible_children, 3)
```

### 8.8 SSO, PIT and Net

```python
sso_rate           = Decimal(str(rates["SSO Employee Contribution Rate (%)"])) / 100   # 0.055
sso_contribution   = Decimal(round(basic_salary * sso_rate, 0))

total_allowances   = sum([position_allowance, years_service_allowance, teaching_allowance,
                          medical_allowance, na_allowance, hazardous_allowance, remote_allowance,
                          foreign_allowance, fuel_benefit, spouse_benefit, child_benefit,
                          other_allowance_1, other_allowance_2, other_allowance_3])

gross_earnings     = basic_salary + total_allowances
taxable_income     = gross_earnings - sso_contribution
pit_amount, bracket_no = calculate_pit(taxable_income, pit_brackets)

total_deductions   = sso_contribution + pit_amount + addl_deduction_1 + addl_deduction_2
net_salary         = gross_earnings - total_deductions

assert net_salary >= 0, "ERR_PAYROLL_NEGATIVE_NET"
```

### 8.9 PIT Progressive Calculation

```python
def calculate_pit(
    taxable_income: Decimal,
    pit_brackets: list[PITBracket]
) -> tuple[Decimal, int]:
    # brackets sorted by bracket_no ascending
    for bracket in reversed(pit_brackets):
        if taxable_income >= bracket.income_from_lak:
            excess = taxable_income - bracket.income_from_lak
            pit = Decimal(bracket.cumulative_tax_lak) + (excess * (Decimal(bracket.rate_pct) / 100))
            return (Decimal(round(pit, 2)), bracket.bracket_no)
    return (Decimal(0), 1)   # Bracket 1: fully exempt
```

---


---

## 9. Search Implementation

**No external search engine is used.** All search is handled within PostgreSQL 16 using built-in extensions. This eliminates the need for Elasticsearch (SSPL licence) or Typesense (GPL licence).

### 9.1 Extensions Enabled

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### 9.2 Search Index on Employee Table

```sql
-- Trigram index for partial-match and fuzzy search on employee_code, names, CSC ID
CREATE INDEX idx_employee_search_trgm ON employee
  USING GIN (
    (employee_code || ' ' || first_name || ' ' || last_name || ' ' || civil_service_card_id)
    gin_trgm_ops
  );

-- Full-text search index for ministry, position, department
CREATE INDEX idx_employee_fts ON employee
  USING GIN (
    to_tsvector('english',
      COALESCE(first_name, '') || ' ' ||
      COALESCE(last_name, '') || ' ' ||
      COALESCE(position_title, '') || ' ' ||
      COALESCE(ministry_name, '') || ' ' ||
      COALESCE(department_name, '')
    )
  );
```

### 9.3 Search Query Pattern

```sql
-- Trigram similarity search (handles partial matches and typos)
SELECT *
FROM employee
WHERE (
  employee_code ILIKE '%' || :query || '%'
  OR similarity(first_name || ' ' || last_name, :query) > 0.3
  OR civil_service_card_id ILIKE '%' || :query || '%'
)
AND (:ministry_filter IS NULL OR ministry_name = :ministry_filter)
AND is_active = true
ORDER BY similarity(first_name || ' ' || last_name, :query) DESC
LIMIT 50 OFFSET :offset;
```

For short queries (< 3 chars): use `ILIKE '%query%'` only (trigram requires ≥ 3 chars).
For queries ≥ 3 chars: use trigram similarity + ILIKE combined.

### 9.4 FastAPI Implementation

List endpoints use `GET /api/v1/employees` with optional `search` query parameter. Filtering uses SQLAlchemy predicates plus `employee_scope_clause` / `assert_employee_accessible` so that `ROLE_MANAGER` and `ROLE_DEPT_OFFICER` only see rows within their assigned scope; `ROLE_ADMIN` is unrestricted. See §4.2 and §4.3.

### 9.5 Payroll Search

Monthly payroll register: same pattern — search by employee_code or name. No fuzzy needed; exact/prefix match sufficient since Finance Officers typically know the employee code.

### 9.6 Audit Log Search

Audit log search: full-text on `table_name`, `row_key`, `changed_by`, `circular_ref` columns using `ILIKE`. Volume is moderate (< 1M rows in 3 years); no additional index needed beyond `idx_audit_table_date`.

---


---

## 10. Reports and Dashboards — React + Recharts

### 10.1 Architecture (v4.0 — Superset Removed)

All reports and dashboards are now React-native components. Data is served by FastAPI aggregation endpoints. Charts use Recharts (MIT). No external BI tool is required.

| Report Type | Generated By | Format |
|---|---|---|
| Dashboard KPI cards | FastAPI aggregation endpoint + Recharts | Interactive React |
| Bar / Line / Pie charts | FastAPI aggregation endpoint + Recharts | Interactive React |
| Individual Payslip | FastAPI + WeasyPrint | PDF |
| Monthly Payroll Register | FastAPI + openpyxl | Excel / PDF |
| Ministry Payroll Summary | FastAPI + openpyxl | Excel |
| SSO Contribution Report | FastAPI + openpyxl | Excel |
| PIT Report | FastAPI + openpyxl | Excel |
| Upcoming Retirements | FastAPI + openpyxl | Excel |
| Audit Change Log | FastAPI + openpyxl | Excel |
| Employee List Export | FastAPI + openpyxl / WeasyPrint | Excel / PDF (scoped; sync/async per §10.3) |

### 10.2 Dashboard Screen Layout

**Route:** `/dashboard`

The dashboard is the post-login landing page. It renders **KPI cards**, a **filter panel** (Department / Location / Manager per role), **scope statistic cards** with a **Progress** bar when a filter value is selected, and **Recharts** visualisations. All aggregation endpoints apply **role-based scoping** (`employee_scope_clause` / dashboard service).

#### 10.2.1 KPI Cards (top row)

| Card | Metric | Visible to |
|---|---|---|
| Total Employees | Scoped total active employees | All roles |
| Data Complete | Complete count / total + fill rate % | Manager, Admin |
| Pending Registrations | Count; navigates to `/admin/registrations` | Manager, Admin |
| Gross Payroll (current month) | Sum gross (scoped for admin) | Admin |
| Net Payroll (current month) | Sum net (scoped for admin) | Admin |

#### 10.2.2 Filter panel and scope stats

- **Department** dropdown: all departments from lookups; on selection, loads **`/dashboard/dept-stats?department=`** and shows **Total in scope**, **Progress** (% complete), filled vs incomplete counts.
- **Location** dropdown: provinces; **`/dashboard/location-stats?location=`** (manager + admin).
- **Manager** dropdown: built from manager scope list (admin/dept officer); manager user sees **self only**; **`/dashboard/manager-stats?manager_user_id=`**.

#### 10.2.3 Charts (implemented)

| Chart | Type | Endpoint |
|---|---|---|
| Data completeness by department | Stacked **Bar** (complete vs incomplete) | `GET /api/v1/dashboard/fill-rate` |
| Employment type mix | **Pie** | `GET /api/v1/dashboard/employment-mix` |
| Monthly payroll trend | **ComposedChart** (gross/net lines + headcount) — **admin** | `GET /api/v1/dashboard/payroll-trend` |
| Grade distribution | **Bar** with label | `GET /api/v1/dashboard/grade-dist` |

#### 10.2.4 FastAPI Aggregation Endpoints (dashboard)

```
GET /api/v1/dashboard/summary           Auth — KPI totals, fill rate, payroll, pending registrations
GET /api/v1/dashboard/fill-rate         Auth — stacked completeness by department
GET /api/v1/dashboard/grade-dist        Auth — grade histogram
GET /api/v1/dashboard/employment-mix    Auth — employment type pie
GET /api/v1/dashboard/dept-stats        Auth — scope stats for selected department
GET /api/v1/dashboard/location-stats    Auth — scope stats for selected province
GET /api/v1/dashboard/manager-stats     Auth — scope stats for selected manager user_id
GET /api/v1/dashboard/payroll-trend     ROLE_ADMIN — 12-month trend
```

Endpoints respect role-based scoping. Filter dropdowns drive the `dept-stats` / `location-stats` / `manager-stats` calls in the UI.

#### 10.2.5 Data Completeness Score (DB trigger — Phase 4)

`is_complete` is a **BOOLEAN** on `employee`, maintained **`BEFORE INSERT OR UPDATE`** by trigger **`trg_employee_completeness`** calling **`fn_employee_completeness()`** (Alembic revision `0003_phase4_role_model`). Logic matches implementation:

```sql
CREATE OR REPLACE FUNCTION fn_employee_completeness()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_complete := (
    NEW.first_name IS NOT NULL AND
    NEW.last_name IS NOT NULL AND
    NEW.date_of_birth IS NOT NULL AND
    NEW.civil_service_card_id IS NOT NULL AND
    NEW.ministry_name IS NOT NULL AND
    NEW.service_province IS NOT NULL AND
    NEW.bank_account_no IS NOT NULL AND
    NEW.grade > 1
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_employee_completeness
  BEFORE INSERT OR UPDATE ON employee
  FOR EACH ROW EXECUTE PROCEDURE fn_employee_completeness();
```

> **Note:** `grade > 1` treats grade **1** as the incomplete/default case (aligned with migration).

### 10.3 Employee List Export

Exports use the **same list filters** as the employee list API (ministry, grade, province, employment type, `is_active`, search, etc.) and **respect role scope** (managers see only in-scope employees; employees see own record where applicable).

#### 10.3.1 Excel Export

```
GET /api/v1/employees/export?format=xlsx&...
```

- **≤ 100 rows:** **synchronous** response — file download in the HTTP response
- **> 100 rows:** **async Celery** job — response includes job id; client polls **`GET /api/v1/reports/jobs/{job_id}`** (or equivalent) for status and download URL when ready
- Columns: aligned with bulk upload / export schema (openpyxl)
- Styling: header row formatting as implemented (bold / fill where applicable)

#### 10.3.2 PDF Export

```
GET /api/v1/employees/export?format=pdf&...
```

- **WeasyPrint**, **synchronous** generation in the implemented flow
- **Maximum 1,000 rows** per export (enforced server-side)
- Layout: tabular employee list; header/footer as implemented

---

## 11. Data Validation Rules

### 11.1 API-Level Validation (pydantic v2 + FastAPI)

All validation at API layer regardless of input source (form or bulk upload). Frontend validation is UX only — never trusted by backend.

| # | Table | Column | Rule | Error Code |
|---|---|---|---|---|
| 1 | EMPLOYEE | employee_code | `^LAO\d{5}$` | `ERR_EMP_INVALID_CODE_FORMAT` |
| 2 | EMPLOYEE | date_of_birth | today − 70yrs ≤ DOB ≤ today − 18yrs | `ERR_EMP_INVALID_DOB` |
| 3 | EMPLOYEE | date_of_joining | joining ≥ DOB+18yrs AND joining ≤ today | `ERR_EMP_INVALID_JOINING` |
| 4 | EMPLOYEE | grade | 1 ≤ grade ≤ 10 | `ERR_VALIDATION` |
| 5 | EMPLOYEE | step | 1 ≤ step ≤ 15 | `ERR_VALIDATION` |
| 6 | EMPLOYEE | eligible_children | 0 ≤ children ≤ 3 | `ERR_VALIDATION` |
| 7 | EMPLOYEE | prior_experience_years | 0 ≤ exp ≤ 40 (warning only) | `WARN_EXP_OUT_OF_RANGE` |
| 8 | EMPLOYEE | bank_account_no | `^\d{9,12}$` AND UNIQUE | `ERR_EMP_BANK_ACCT_DUPLICATE` |
| 9 | EMPLOYEE | civil_service_card_id | `^CSC\d{6}$` AND UNIQUE | `ERR_EMP_CSC_DUPLICATE` |
| 10 | EMPLOYEE | email | ends `@gov.la` AND UNIQUE | `ERR_EMP_EMAIL_DUPLICATE` |
| 11 | EMPLOYEE | ministry_name | FK → lk_org_master | `ERR_EMP_FK_MINISTRY` |
| 12 | EMPLOYEE | service_province | FK → lk_location_master | `ERR_EMP_FK_PROVINCE` |
| 13 | EMPLOYEE | bank_name | FK → lk_bank_master | `ERR_EMP_FK_BANK` |
| 14 | EMPLOYEE | position_level | FK → lk_allowance_rates | `ERR_EMP_FK_POSITION_LEVEL` |
| 15 | PAYROLL_MONTHLY | net_salary_lak | net_salary ≥ 0 | `ERR_PAYROLL_NEGATIVE_NET` |
| 16 | PAYROLL_MONTHLY | basic_salary_lak | = index × rate | `ERR_PAYROLL_BASIC_MISMATCH` |
| 17 | PAYROLL_MONTHLY | sso_employee_contribution | = ROUND(basic × 5.5%, 0) | `ERR_PAYROLL_SSO_MISMATCH` |
| 18 | LK_GRADE_STEP | grade_step_index | > 0 | `ERR_VALIDATION` |
| 19 | LK_GRADE_STEP | salary_index_rate | > 0 AND ≤ 5,000,000 | `ERR_VALIDATION` |
| 20 | LK_PIT_BRACKETS | rate_pct | 0 ≤ rate ≤ 100 | `ERR_VALIDATION` |
| 21 | LK_ALLOWANCE_RATES | amount_or_rate | > 0 | `ERR_VALIDATION` |
| 22 | Master tables | Key fields on PUT | key field must not change | `ERR_MASTER_KEY_IMMUTABLE` |

### 11.2 Database Constraints

```sql
-- Enforced at DB level regardless of API
UNIQUE (employee_code);
UNIQUE (civil_service_card_id);
UNIQUE (bank_account_no);
UNIQUE (email);
UNIQUE (sso_number) WHERE sso_number IS NOT NULL;
UNIQUE (employee_code, payroll_month) ON payroll_monthly;
CHECK (eligible_children BETWEEN 0 AND 3);
CHECK (net_salary_lak >= 0) ON payroll_monthly;
```

### 11.3 Duplicate check rules (applies to all input methods)

| Field | Unique Constraint | Error Code |
|---|---|---|
| employee_code | UNIQUE in employee table | ERR_EMP_CODE_DUPLICATE |
| email | UNIQUE in employee table | ERR_EMP_EMAIL_DUPLICATE |
| civil_service_card_id | UNIQUE in employee table | ERR_EMP_CSC_DUPLICATE |
| bank_account_no | UNIQUE in employee table | ERR_EMP_BANK_ACCT_DUPLICATE |
| sso_number | UNIQUE WHERE NOT NULL | ERR_EMP_SSO_DUPLICATE |

For Option 3 (online grid) and bulk upload: duplicates within the same submission are also detected before DB insert.

---

## 12. Database Schema — Developer Detail

> **Normative baseline:** The following subsections document the Phase 1 relational model. **Alembic migrations** in the repository are authoritative where they differ. **Phase 4** additions begin at §12.1.

### 12.0.1 Main Tables

```sql
-- ============================================================
-- EMPLOYEE
-- ============================================================
CREATE TABLE employee (
  employee_code           VARCHAR(10)   PRIMARY KEY,
  title                   VARCHAR(10)   NOT NULL
                            CHECK (title IN ('Mr.','Ms.','Mrs.','Dr.','Prof.')),
  first_name              VARCHAR(80)   NOT NULL,
  last_name               VARCHAR(80)   NOT NULL,
  gender                  VARCHAR(6)    NOT NULL CHECK (gender IN ('Male','Female')),
  date_of_birth           DATE          NOT NULL,
  email                   VARCHAR(100)  UNIQUE NOT NULL,
  mobile_number           VARCHAR(20),
  date_of_joining         DATE          NOT NULL,
  employment_type         VARCHAR(15)   NOT NULL DEFAULT 'Permanent'
                            CHECK (employment_type IN ('Permanent','Probationary','Contract','Intern')),
  position_title          VARCHAR(100)  NOT NULL,
  education_level         VARCHAR(40)   NOT NULL,
  prior_experience_years  INT           DEFAULT 0
                            CHECK (prior_experience_years >= 0 AND prior_experience_years <= 40),
  grade                   INT           NOT NULL CHECK (grade BETWEEN 1 AND 10),
  step                    INT           NOT NULL CHECK (step BETWEEN 1 AND 15),
  civil_service_card_id   VARCHAR(12)   UNIQUE NOT NULL,
  sso_number              VARCHAR(12)   UNIQUE,
  ministry_name           VARCHAR(80)   NOT NULL REFERENCES lk_org_master(ministry_name),
  department_name         VARCHAR(80)   NOT NULL,
  division_name           VARCHAR(60),
  service_country         VARCHAR(30)   NOT NULL DEFAULT 'Lao PDR',
  service_province        VARCHAR(60)   NOT NULL REFERENCES lk_location_master(province),
  service_district        VARCHAR(60),
  profession_category     VARCHAR(20)   NOT NULL,
  is_remote_area          BOOLEAN       NOT NULL DEFAULT false,
  is_foreign_posting      BOOLEAN       NOT NULL DEFAULT false,
  is_hazardous_area       BOOLEAN       NOT NULL DEFAULT false,
  house_no                VARCHAR(30),
  street                  VARCHAR(100),
  area_baan               VARCHAR(80),
  province_of_residence   VARCHAR(60),
  pin_code                VARCHAR(10),
  residence_country       VARCHAR(60),
  bank_name               VARCHAR(70)   NOT NULL REFERENCES lk_bank_master(bank_name),
  bank_branch             VARCHAR(60)   NOT NULL,
  bank_branch_code        VARCHAR(10),
  bank_account_no         VARCHAR(20)   UNIQUE NOT NULL,
  swift_code              VARCHAR(12),
  has_spouse              BOOLEAN       NOT NULL DEFAULT false,
  eligible_children       INT           NOT NULL DEFAULT 0
                            CHECK (eligible_children BETWEEN 0 AND 3),
  position_level          VARCHAR(80)   NOT NULL REFERENCES lk_allowance_rates(allowance_name),
  is_na_member            BOOLEAN       NOT NULL DEFAULT false,
  field_allowance_type    VARCHAR(10)   NOT NULL DEFAULT 'None'
                            CHECK (field_allowance_type IN ('Teaching','Medical','None')),
  is_active               BOOLEAN       NOT NULL DEFAULT true,
  created_at              TIMESTAMP     NOT NULL DEFAULT now(),
  created_by              VARCHAR(80)   NOT NULL,
  updated_at              TIMESTAMP,
  updated_by              VARCHAR(80)
);

-- ============================================================
-- PAYROLL_MONTHLY
-- ============================================================
CREATE TABLE payroll_monthly (
  employee_code               VARCHAR(10)   NOT NULL REFERENCES employee(employee_code),
  payroll_month               DATE          NOT NULL, -- Always first day of month: 2026-03-01
  grade                       INT           NOT NULL,
  step                        INT           NOT NULL,
  grade_step_key              VARCHAR(10)   NOT NULL,
  grade_step_index            INT           NOT NULL,
  salary_index_rate           DECIMAL(10,0) NOT NULL,
  basic_salary_lak            DECIMAL(14,0) NOT NULL,
  position_allowance_lak      DECIMAL(14,0) NOT NULL DEFAULT 0,
  years_service_allowance_lak DECIMAL(14,0) NOT NULL DEFAULT 0,
  teaching_allowance_lak      DECIMAL(14,0) NOT NULL DEFAULT 0,
  medical_allowance_lak       DECIMAL(14,0) NOT NULL DEFAULT 0,
  na_member_allowance_lak     DECIMAL(14,0) NOT NULL DEFAULT 0,
  hazardous_allowance_lak     DECIMAL(14,0) NOT NULL DEFAULT 0,
  remote_allowance_lak        DECIMAL(14,0) NOT NULL DEFAULT 0,
  foreign_living_allow_lak    DECIMAL(14,0) NOT NULL DEFAULT 0,
  fuel_benefit_lak            DECIMAL(14,0) NOT NULL DEFAULT 0,
  spouse_benefit_lak          DECIMAL(14,0) NOT NULL DEFAULT 0,
  child_benefit_lak           DECIMAL(14,0) NOT NULL DEFAULT 0,
  other_allowance_1_lak       DECIMAL(14,0) NOT NULL DEFAULT 0,
  other_allowance_1_desc      VARCHAR(200),
  other_allowance_2_lak       DECIMAL(14,0) NOT NULL DEFAULT 0,
  other_allowance_2_desc      VARCHAR(200),
  other_allowance_3_lak       DECIMAL(14,0) NOT NULL DEFAULT 0,
  other_allowance_3_desc      VARCHAR(200),
  total_allowances_lak        DECIMAL(14,0) NOT NULL,
  gross_earnings_lak          DECIMAL(14,0) NOT NULL,
  sso_rate_ref                VARCHAR(80)   NOT NULL REFERENCES lk_allowance_rates(allowance_name),
  sso_employee_contribution   DECIMAL(14,0) NOT NULL,
  taxable_income_lak          DECIMAL(14,0) NOT NULL,
  applicable_bracket_no       INT           NOT NULL REFERENCES lk_pit_brackets(bracket_no),
  pit_amount_lak              DECIMAL(14,2) NOT NULL,
  addl_deduction_1_lak        DECIMAL(14,0) NOT NULL DEFAULT 0,
  addl_deduction_1_desc       VARCHAR(200),
  addl_deduction_2_lak        DECIMAL(14,0) NOT NULL DEFAULT 0,
  addl_deduction_2_desc       VARCHAR(200),
  total_deductions_lak        DECIMAL(14,2) NOT NULL,
  net_salary_lak              DECIMAL(14,2) NOT NULL CHECK (net_salary_lak >= 0),
  approval_status             VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                                CHECK (approval_status IN ('PENDING','APPROVED','LOCKED')),
  approved_by                 VARCHAR(80),
  approved_at                 TIMESTAMP,
  is_locked                   BOOLEAN       NOT NULL DEFAULT false,
  locked_by                   VARCHAR(80),
  locked_at                   TIMESTAMP,
  calculated_at               TIMESTAMP     NOT NULL DEFAULT now(),
  calculated_by               VARCHAR(80)   NOT NULL,
  PRIMARY KEY (employee_code, payroll_month)
);

-- Archive table (identical structure + archive metadata)
CREATE TABLE payroll_monthly_archive (
  LIKE payroll_monthly INCLUDING ALL,
  archived_at     TIMESTAMP NOT NULL DEFAULT now(),
  archive_reason  VARCHAR(200)
);
-- Remove PK inherited from LIKE (archive can have same records from retriggers)
ALTER TABLE payroll_monthly_archive DROP CONSTRAINT IF EXISTS payroll_monthly_archive_pkey;
ALTER TABLE payroll_monthly_archive ADD PRIMARY KEY (employee_code, payroll_month, archived_at);

-- Unified view for transparent reads across active + archived
CREATE VIEW payroll_all AS
  SELECT *, false AS is_archived FROM payroll_monthly
  UNION ALL
  SELECT *, true AS is_archived
  FROM payroll_monthly_archive
  WHERE (employee_code, payroll_month, archived_at) IN (
    SELECT employee_code, payroll_month, MAX(archived_at)
    FROM payroll_monthly_archive GROUP BY employee_code, payroll_month
  );
```

### 12.0.2 Lookup Tables

```sql
CREATE TABLE lk_org_master (
  ministry_name           VARCHAR(80)  NOT NULL,
  ministry_key            VARCHAR(10)  UNIQUE NOT NULL,
  department_name         VARCHAR(80)  NOT NULL,
  department_key          VARCHAR(12)  UNIQUE NOT NULL,
  division_name           VARCHAR(60),
  profession_category     VARCHAR(20)  NOT NULL
    CHECK (profession_category IN ('Teacher','Medical','Finance','Administration','Technical','Legal','Diplomatic','General')),
  na_allowance_eligible   BOOLEAN      NOT NULL DEFAULT false,
  field_allowance_type    VARCHAR(10)  NOT NULL DEFAULT 'None'
    CHECK (field_allowance_type IN ('Teaching','Medical','None')),
  effective_from          DATE,
  effective_to            DATE,
  last_updated            DATE,
  last_updated_by         VARCHAR(80),
  circular_ref            VARCHAR(80),
  change_remarks          VARCHAR(200),
  PRIMARY KEY (ministry_name, department_key)
);

CREATE TABLE lk_location_master (
  province          VARCHAR(60)   PRIMARY KEY,
  country           VARCHAR(30)   NOT NULL,
  province_key      VARCHAR(10)   UNIQUE NOT NULL,
  district          VARCHAR(60)   NOT NULL,
  is_remote         BOOLEAN       NOT NULL DEFAULT false,
  is_hazardous      BOOLEAN       NOT NULL DEFAULT false,
  notes             VARCHAR(200),
  effective_from    DATE,
  effective_to      DATE,
  last_updated      DATE,
  last_updated_by   VARCHAR(80),
  circular_ref      VARCHAR(80),
  change_remarks    VARCHAR(200)
);

CREATE TABLE lk_bank_master (
  bank_name       VARCHAR(70)   NOT NULL,
  bank_key        VARCHAR(6)    NOT NULL,
  branch_name     VARCHAR(60)   NOT NULL,
  branch_code     VARCHAR(10)   UNIQUE NOT NULL,
  swift_code      VARCHAR(12)   NOT NULL,
  effective_from  DATE,
  effective_to    DATE,
  last_updated    DATE,
  last_updated_by VARCHAR(80),
  circular_ref    VARCHAR(80),
  change_remarks  VARCHAR(200),
  PRIMARY KEY (bank_name, branch_name)
);
CREATE UNIQUE INDEX idx_bank_name ON lk_bank_master(bank_name);  -- for FK reference

CREATE TABLE lk_grade_step (
  grade               INT           NOT NULL CHECK (grade BETWEEN 1 AND 10),
  step                INT           NOT NULL CHECK (step BETWEEN 1 AND 15),
  grade_step_key      VARCHAR(10)   GENERATED ALWAYS AS (
                        'G' || LPAD(grade::TEXT, 2, '0') || '-S' || LPAD(step::TEXT, 2, '0')
                      ) STORED,
  grade_step_index    INT           NOT NULL CHECK (grade_step_index > 0),
  salary_index_rate   DECIMAL(10,0) NOT NULL DEFAULT 10000,
  min_education       VARCHAR(40),
  notes               VARCHAR(200),
  effective_from      DATE,
  effective_to        DATE,
  last_updated        DATE,
  last_updated_by     VARCHAR(80),
  circular_ref        VARCHAR(80),
  change_remarks      VARCHAR(200),
  PRIMARY KEY (grade, step)
);

CREATE TABLE lk_grade_derivation (
  education_level   VARCHAR(40)   NOT NULL,
  exp_min_years     INT           NOT NULL CHECK (exp_min_years >= 0),
  exp_max_years     INT           NOT NULL,
  derived_grade     INT           NOT NULL REFERENCES lk_grade_step(grade)
                      MATCH SIMPLE ON UPDATE NO ACTION ON DELETE RESTRICT,
  derived_step      INT           NOT NULL,
  rule_description  VARCHAR(200),
  effective_from    DATE,
  effective_to      DATE,
  last_updated      DATE,
  last_updated_by   VARCHAR(80),
  circular_ref      VARCHAR(80),
  change_remarks    VARCHAR(200),
  PRIMARY KEY (education_level, exp_min_years),
  CHECK (exp_max_years >= exp_min_years)
);

CREATE TABLE lk_allowance_rates (
  allowance_name    VARCHAR(80)    PRIMARY KEY,
  amount_or_rate    DECIMAL(15,2)  NOT NULL CHECK (amount_or_rate > 0),
  eligibility       VARCHAR(200),
  effective_from    DATE,
  effective_to      DATE,
  last_updated      DATE,
  last_updated_by   VARCHAR(80),
  circular_ref      VARCHAR(80),
  change_remarks    VARCHAR(200)
);

CREATE TABLE lk_pit_brackets (
  bracket_no          INT            PRIMARY KEY,
  income_from_lak     DECIMAL(15,0)  NOT NULL CHECK (income_from_lak >= 0),
  income_to_lak       DECIMAL(15,0)  NOT NULL,
  rate_pct            DECIMAL(5,2)   NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  cumulative_tax_lak  DECIMAL(15,0)  NOT NULL DEFAULT 0,
  description         VARCHAR(100),
  effective_from      DATE,
  effective_to        DATE,
  last_updated        DATE,
  last_updated_by     VARCHAR(80),
  circular_ref        VARCHAR(80),
  change_remarks      VARCHAR(200),
  CHECK (income_to_lak > income_from_lak)
);
```

### 12.0.3 Supporting Tables

```sql
CREATE TABLE app_user (
  user_id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  username              VARCHAR(60)   UNIQUE NOT NULL,
  full_name             VARCHAR(120)  NOT NULL,
  email                 VARCHAR(120)  UNIQUE NOT NULL,
  password_hash         VARCHAR(255)  NOT NULL,
  role                  VARCHAR(30)   NOT NULL
    CHECK (role IN ('ROLE_EMPLOYEE','ROLE_MANAGER','ROLE_DEPT_OFFICER','ROLE_ADMIN')),
  ministry_scope        VARCHAR(80),  -- optional legacy column; scope is resolved via manager_scope / dept_officer_scope in the four-role model
  preferred_language    CHAR(2)       NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','lo')),
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  force_password_change BOOLEAN       NOT NULL DEFAULT false,
  failed_login_count    INT           NOT NULL DEFAULT 0,
  locked_until          TIMESTAMP,
  created_at            TIMESTAMP     NOT NULL DEFAULT now(),
  last_login            TIMESTAMP
);

CREATE TABLE audit_log (
  id              BIGSERIAL     PRIMARY KEY,
  table_name      VARCHAR(50)   NOT NULL,
  row_key         VARCHAR(200)  NOT NULL,
  field_name      VARCHAR(80)   NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  changed_by      VARCHAR(80)   NOT NULL,
  changed_at      TIMESTAMP     NOT NULL DEFAULT now(),
  circular_ref    VARCHAR(80),
  change_remarks  TEXT
);
-- Append-only: revoke UPDATE, DELETE from app role
REVOKE UPDATE, DELETE ON audit_log FROM payroll_app_role;

CREATE TABLE celery_task_result (
  task_id         VARCHAR(155)  PRIMARY KEY,
  task_name       VARCHAR(155),
  status          VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
  result          JSONB,
  date_done       TIMESTAMP,
  traceback       TEXT,
  created_at      TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE TABLE system_job_log (
  id            BIGSERIAL     PRIMARY KEY,
  job_type      VARCHAR(50)   NOT NULL,  -- 'PAYROLL_RUN' | 'ARCHIVAL' | 'BULK_UPLOAD'
  triggered_by  VARCHAR(80),
  started_at    TIMESTAMP     NOT NULL DEFAULT now(),
  completed_at  TIMESTAMP,
  status        VARCHAR(20)   NOT NULL DEFAULT 'RUNNING',
  records_in    INT,
  records_out   INT,
  error_detail  TEXT
);
```

### 12.0.4 Indexes

```sql
-- Employee
CREATE INDEX idx_employee_ministry        ON employee(ministry_name);
CREATE INDEX idx_employee_grade_step      ON employee(grade, step);
CREATE INDEX idx_employee_province        ON employee(service_province);
CREATE INDEX idx_employee_active          ON employee(is_active);
CREATE INDEX idx_employee_employment_type ON employee(employment_type);
CREATE INDEX idx_employee_search_trgm     ON employee
  USING GIN ((employee_code||' '||first_name||' '||last_name||' '||civil_service_card_id) gin_trgm_ops);

-- Payroll
CREATE INDEX idx_payroll_month            ON payroll_monthly(payroll_month);
CREATE INDEX idx_payroll_ministry_month   ON payroll_monthly(payroll_month)
  INCLUDE (employee_code);  -- covering index for ministry-scoped queries via RLS join

-- Archive
CREATE INDEX idx_archive_month            ON payroll_monthly_archive(payroll_month);
CREATE INDEX idx_archive_emp_month        ON payroll_monthly_archive(employee_code, payroll_month);

-- Audit log
CREATE INDEX idx_audit_table_date         ON audit_log(table_name, changed_at DESC);
CREATE INDEX idx_audit_changed_by         ON audit_log(changed_by);
```

---

### 12.1 New Tables

```sql
-- Manager scope mapping
CREATE TABLE manager_scope (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  location        VARCHAR(60)  NOT NULL REFERENCES lk_location_master(province),
  department_name VARCHAR(80)  NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMP    NOT NULL DEFAULT now(),
  created_by      VARCHAR(80)  NOT NULL,
  UNIQUE (user_id, location, department_name)
);
CREATE INDEX idx_manager_scope_user ON manager_scope(user_id);

-- Department Officer scope mapping
CREATE TABLE dept_officer_scope (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  department_name VARCHAR(80)  NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMP    NOT NULL DEFAULT now(),
  created_by      VARCHAR(80)  NOT NULL,
  UNIQUE (user_id, department_name)
);
CREATE INDEX idx_dept_officer_scope_user ON dept_officer_scope(user_id);
```

### 12.2 Employee Table Additions (Phase 4 — Alembic `0003_phase4_role_model`)

```sql
ALTER TABLE employee ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID REFERENCES app_user(user_id);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS owner_role VARCHAR(30);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS is_complete BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20)
  NOT NULL DEFAULT 'ACTIVE';
-- CHECK registration_status IN ('PENDING','ACTIVE','REJECTED') via named constraint
```

- **`is_complete`:** maintained by **`fn_employee_completeness`** / **`trg_employee_completeness`** — see **§10.2.5**.
- **`uploaded_by_user_id` / `owner_role`:** support **§4.3** edit rules.

### 12.2.1 Master employee counts (API cache, not a table)

Aggregated counts for Organisation / Location / Manager Master UIs are computed from **`employee`** (`is_active = true`) and exposed via **`GET /api/v1/master/employee-counts`**, cached in **Valkey** under key **`master:employee-counts`**, TTL **300 seconds** (see §13).

### 12.3 app_user Role Constraint Update

```sql
-- Update CHECK constraint to new 4-role model
ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_role_check;
ALTER TABLE app_user ADD CONSTRAINT app_user_role_check
  CHECK (role IN ('ROLE_EMPLOYEE','ROLE_MANAGER','ROLE_DEPT_OFFICER','ROLE_ADMIN'));
```

### 12.4 app_user — registration_status

```sql
ALTER TABLE app_user ADD COLUMN registration_status VARCHAR(20)
  NOT NULL DEFAULT 'ACTIVE'
  CHECK (registration_status IN ('PENDING','ACTIVE','REJECTED'));
```

---


## 13. API Endpoints — Full Catalogue

Base URL: `/api/v1`  
Auth header: `Authorization: Bearer {access_token}`  
All responses: `{ "success": bool, "data": any, "pagination": {...} | null, "error": {...} | null }`

```
# AUTH
POST   /auth/login                          Public
POST   /auth/refresh                        Cookie
POST   /auth/logout                         Auth

# EMPLOYEES
GET    /employees                           Auth          ?page ?limit ?search ?ministry ?grade ?employment_type ?is_active
POST   /employees                           ROLE_MANAGER, ROLE_ADMIN, ROLE_EMPLOYEE (own)
GET    /employees/{code}                    Auth
PUT    /employees/{code}                    Per §4.3
PATCH  /employees/{code}                    Per §4.3
DELETE /employees/{code}                    ROLE_MANAGER, ROLE_ADMIN (scoped)

# BULK UPLOAD
GET    /bulk-upload/employee/template       ROLE_MANAGER, ROLE_ADMIN
POST   /bulk-upload/employee/validate       ROLE_MANAGER, ROLE_ADMIN
GET    /bulk-upload/employee/error-report/{session_id}    ROLE_MANAGER, ROLE_ADMIN
POST   /bulk-upload/employee/confirm        ROLE_MANAGER, ROLE_ADMIN

GET    /bulk-upload/payroll-free-fields/template          ROLE_ADMIN  ?month=2026-03
POST   /bulk-upload/payroll-free-fields/validate          ROLE_ADMIN
POST   /bulk-upload/payroll-free-fields/confirm           ROLE_ADMIN

# PAYROLL
POST   /payroll/run                         ROLE_ADMIN
GET    /payroll/jobs/{job_id}               ROLE_ADMIN
GET    /payroll/monthly                     Auth (scoped)
PATCH  /payroll/monthly/{code}/{month}      ROLE_ADMIN (free fields)
POST   /payroll/approve                     ROLE_ADMIN
POST   /payroll/lock                        ROLE_ADMIN
POST   /payroll/unlock                      ROLE_ADMIN

# LOOKUPS
GET    /lookups/ministries                  Auth
GET    /lookups/departments                 Auth          ?ministry_key
GET    /lookups/divisions                   Auth          ?dept_key
GET    /lookups/org-derived                 Auth          ?ministry_name
GET    /lookups/countries                   Auth
GET    /lookups/provinces                   Auth          ?country_key
GET    /lookups/districts                   Auth          ?province_key
GET    /lookups/location-derived            Auth          ?province
GET    /lookups/banks                       Auth
GET    /lookups/branches                    Auth          ?bank_key
GET    /lookups/bank-derived                Auth          ?bank_name&branch_name
GET    /lookups/grade-derive                Auth          ?education_level&prior_experience_years

# MASTER DATA (writes: ROLE_ADMIN)
GET    /master/grade-step                   Auth
PUT    /master/grade-step/{grade}/{step}    ROLE_ADMIN
GET    /master/allowance-rates              Auth
PUT    /master/allowance-rates/{name}       ROLE_ADMIN
GET    /master/grade-derivation             Auth
PUT    /master/grade-derivation/{edu}/{exp} ROLE_ADMIN
GET    /master/org                          Auth
POST   /master/org                          ROLE_ADMIN
PUT    /master/org/{ministry_key}/{dept_key} ROLE_ADMIN
GET    /master/location                     Auth
POST   /master/location                     ROLE_ADMIN
PUT    /master/location/{province_key}      ROLE_ADMIN
GET    /master/bank                         Auth
POST   /master/bank                         ROLE_ADMIN
GET    /master/pit-brackets                 Auth
PUT    /master/pit-brackets/{bracket_no}    ROLE_ADMIN

# REPORTS (FastAPI-generated files)
GET    /reports/payroll-register            Auth    ?month ?ministry ?export=pdf|xlsx
GET    /reports/payslip/{code}/{month}      Auth    ?export=pdf
GET    /reports/ministry-summary            Auth    ?month ?export=xlsx
GET    /reports/employee-list               Auth    ?ministry ?grade ?province ?export=xlsx
GET    /reports/allowance-breakdown         ROLE_ADMIN ?month ?ministry ?export=xlsx
GET    /reports/sso                         ROLE_ADMIN ?month ?export=xlsx
GET    /reports/pit                         ROLE_ADMIN ?month ?ministry ?export=xlsx
GET    /reports/retirements                 Auth    ?months_ahead=12 ?ministry ?export=xlsx
GET    /reports/foreign-postings            ROLE_ADMIN ?month ?export=xlsx
GET    /reports/audit-log                   ROLE_ADMIN ?table ?from ?to ?changed_by ?export=xlsx
GET    /reports/jobs/{job_id}               Auth

# ARCHIVE
GET    /archive/payroll                     ROLE_ADMIN ?month ?ministry ?page ?limit
POST   /archive/trigger                     ROLE_ADMIN

# ADMIN
GET    /admin/users                         ROLE_ADMIN
POST   /admin/users                         ROLE_ADMIN
PUT    /admin/users/{user_id}               ROLE_ADMIN
GET    /admin/users/{user_id}/login-history ROLE_ADMIN
GET    /admin/system-jobs                   ROLE_ADMIN

# DASHBOARD (React + Recharts — see §10.2.4)
GET    /dashboard/summary                   Auth
GET    /dashboard/fill-rate                 Auth
GET    /dashboard/grade-dist                Auth
GET    /dashboard/employment-mix            Auth
GET    /dashboard/dept-stats                Auth          ?department=
GET    /dashboard/location-stats            Auth          ?location=
GET    /dashboard/manager-stats             Auth          ?manager_user_id=
GET    /dashboard/payroll-trend             ROLE_ADMIN

# EMPLOYEE EXPORT
GET    /employees/export                    Auth    ?format=xlsx|pdf & filters

# DUPLICATE CHECK
GET    /employees/check-duplicate           Auth    ?field=email&value=

# REGISTRATION
POST   /auth/register                       Public
GET    /admin/registrations                 ROLE_MANAGER, ROLE_ADMIN
POST   /admin/registrations/{user_id}/approve   ROLE_MANAGER, ROLE_ADMIN
POST   /admin/registrations/{user_id}/reject    ROLE_MANAGER, ROLE_ADMIN

# ONLINE GRID ENTRY
POST   /employees/batch                     ROLE_EMPLOYEE, ROLE_MANAGER, ROLE_ADMIN

# MANAGER / DEPT OFFICER SCOPE
GET    /master/manager-scope                ROLE_ADMIN, ROLE_DEPT_OFFICER
POST   /master/manager-scope                ROLE_ADMIN, ROLE_DEPT_OFFICER
DELETE /master/manager-scope/{id}           ROLE_ADMIN, ROLE_DEPT_OFFICER
GET    /master/manager-scope/my-scope       ROLE_MANAGER
GET    /master/dept-officer-scope           ROLE_ADMIN
POST   /master/dept-officer-scope           ROLE_ADMIN
DELETE /master/dept-officer-scope/{id}     ROLE_ADMIN

GET    /master/employee-counts              Auth (aggregated counts; Valkey TTL 300s)
```

## 14. Internationalisation (i18n) — English and Lao Script

### 14.1 Implementation

- **react-i18next** with JSON translation files:
  - `public/locales/en/translation.json`
  - `public/locales/lo/translation.json`
- Language toggle in top nav bar (EN | ລາວ). User preference persisted in `app_user.preferred_language` and in `localStorage` for pre-login screens
- All JSX uses `t('key')` — zero hardcoded English strings
- HTML `<html lang="en">` / `<html lang="lo">` updates on switch
- `document.documentElement.setAttribute('lang', language)` called on change

### 14.2 Lao Font Setup

```css
/* index.css */
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Lao:wght@400;700&display=swap');

body[lang="lo"],
body[lang="lo"] .ant-table,
body[lang="lo"] .ant-form-item-label,
body[lang="lo"] .ant-btn {
  font-family: 'Noto Serif Lao', 'Noto Sans Lao', serif;
  word-break: break-word;
  overflow-wrap: break-word;
}
```

For production bundles without CDN access, include Noto Serif Lao as a self-hosted font in `/public/fonts/`.

### 14.3 Numbers and Dates

- All monetary amounts: Western numerals + LAK suffix; formatted via `Intl.NumberFormat('lo-LA')` or a utility function
- Dates: `en-GB` format (DD-MMM-YYYY) for English; Lao month names for Lao UI via i18n key mapping
- DB stores all dates in ISO 8601; formatting is frontend-only

### 14.4 What Must Be Translated

- All navigation menu labels
- All form field labels, placeholders, and helper text
- All dropdown option labels that are user-visible (not DB key values)
- All button labels
- All error messages and validation text
- All table column headers
- All report titles and column headers
- All dashboard widget titles
- All modal titles and confirmation text

### 14.5 What Is NOT Translated (Phase 1)

- DB master data content (Ministry names, Province names, Allowance names) — stored and displayed in English only
- Add `display_name_lo` columns to lk_org_master and lk_location_master in Phase 2 migration if bilingual master data is required

---



### 14.6 Additional navigation keys

```json
// Add to en/translation.json
"nav": {
  "dashboard": "Dashboard",
  "employees": "Employees",
  "payroll": "Payroll",
  "masterData": "Master Data",
  "audit": "Audit Trail",
  "userManagement": "User Management",
  "managerMaster": "Manager Master",
  "deptOfficerMaster": "Department Officer Master",
  "gridEntry": "Online Grid Entry"
},
"dashboard": {
  "totalEmployees": "Total Employees",
  "byLocation": "By Location",
  "byDepartment": "By Department",
  "fillRate": "Data Fill Rate",
  "totalStrength": "Total Strength",
  "grossPayroll": "Gross Payroll",
  "netPayroll": "Net Payroll"
}
```


---

## 15. Data Archival Strategy

### 15.1 Policy

| Data | Active Window | Archive Trigger | Destination |
|---|---|---|---|
| PAYROLL_MONTHLY | Most recent 3 years | Payroll month > 3 years old AND is_locked = true | payroll_monthly_archive |
| EMPLOYEE | Never archived | Soft-delete only (is_active = false) | Same table |
| Lookup tables | Never archived | Audit trail captures all historical values | audit_log |

### 15.2 Archival Celery Beat Job

```python
# Runs: 1st of each month at 02:00 UTC+7 (Lao time)
# Celery beat schedule: crontab(hour=19, minute=0, day_of_month=1)  # 02:00+7 = 19:00 UTC previous day

@shared_task
def archive_old_payroll():
    cutoff = date.today() - relativedelta(years=3)
    with db_session() as session:
        # Only archive locked months
        months_to_archive = session.execute(
            select(func.distinct(payroll_monthly.c.payroll_month))
            .where(payroll_monthly.c.payroll_month < cutoff)
            .where(payroll_monthly.c.is_locked == True)
        ).scalars().all()

        for month in months_to_archive:
            session.execute(
                insert(payroll_monthly_archive)
                .from_select(
                    [all columns] + [literal(now()).label('archived_at'),
                     literal('Scheduled 3-year archival').label('archive_reason')],
                    select(payroll_monthly).where(payroll_monthly.c.payroll_month == month)
                )
            )
            session.execute(
                delete(payroll_monthly).where(payroll_monthly.c.payroll_month == month)
            )

        session.execute(
            insert(system_job_log).values(
                job_type='ARCHIVAL', triggered_by='scheduler',
                records_out=total_archived, status='DONE'
            )
        )
```

Unlocked months older than 3 years: flagged in System Admin dashboard as `PENDING_LOCK_FOR_ARCHIVAL`; not auto-archived.

### 15.3 Archive Retrieval

All service-layer payroll reads use the `payroll_all` view (unions active + archive). Report queries use the same view with `?include_archived=true` flag.

```python
# FastAPI query: transparent to caller
query = select(payroll_all).where(
    payroll_all.c.payroll_month.between(date_from, date_to)
)
# is_archived column in response indicates whether record came from archive
```

---


---

## 16. Deployment — Docker Production

### 16.1 Architecture

```
Internet
    │
   [Nginx :443]  ←── TLS termination (Let's Encrypt or self-signed for air-gapped gov env)
    │
    ├── /              → React (static files served by Nginx)
    ├── /api/          → FastAPI :8000
    └── /flower/       → Celery Flower :5555 (Admin only)
```

All containers on a private Docker bridge network `payroll_net`. Only Nginx exposes external ports (80, 443).

### 16.2 docker-compose.yml

```yaml
version: "3.9"

services:

  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
      - frontend_build:/usr/share/nginx/html:ro
    depends_on:
      - api
    networks:
      - payroll_net
    restart: always

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: "postgresql+asyncpg://payroll_app:${DB_APP_PASS}@postgres:5432/payroll_db"
      VALKEY_URL: "redis://valkey:6379/0"
      CELERY_BROKER_URL: "redis://valkey:6379/1"
      SECRET_KEY: "${JWT_SECRET_KEY}"
      # SUPERSET_URL (removed): "http://superset:8088"
      # SUPERSET_ADMIN_USER (removed): "${SUPERSET_ADMIN_USER}"
      # SUPERSET_ADMIN_PASS (removed): "${SUPERSET_ADMIN_PASS}"
      UPLOAD_DIR: "/app/uploads"
      REPORTS_DIR: "/app/reports"
    volumes:
      - uploads:/app/uploads
      - reports:/app/reports
    depends_on:
      - postgres
      - valkey
    networks:
      - payroll_net
    restart: always

  celery_worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.celery_app worker --loglevel=info --concurrency=4
    environment:
      DATABASE_URL: "postgresql+asyncpg://payroll_app:${DB_APP_PASS}@postgres:5432/payroll_db"
      VALKEY_URL: "redis://valkey:6379/0"
      CELERY_BROKER_URL: "redis://valkey:6379/1"
      UPLOAD_DIR: "/app/uploads"
      REPORTS_DIR: "/app/reports"
    volumes:
      - uploads:/app/uploads
      - reports:/app/reports
    depends_on:
      - postgres
      - valkey
    networks:
      - payroll_net
    restart: always

  celery_beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.celery_app beat --loglevel=info --scheduler=celery.beat:PersistentScheduler
    environment:
      DATABASE_URL: "postgresql+asyncpg://payroll_app:${DB_APP_PASS}@postgres:5432/payroll_db"
      VALKEY_URL: "redis://valkey:6379/0"
      CELERY_BROKER_URL: "redis://valkey:6379/1"
    depends_on:
      - postgres
      - valkey
    networks:
      - payroll_net
    restart: always

  flower:
    image: mher/flower:2.0.1    # MIT licence
    command: celery --broker=redis://valkey:6379/1 flower --port=5555
    environment:
      FLOWER_BASIC_AUTH: "admin:${FLOWER_PASS}"
    depends_on:
      - valkey
    networks:
      - payroll_net
    restart: always
    # NOT exposed externally — Nginx proxies /flower/ only for ROLE_ADMIN

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: payroll_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: "${DB_ROOT_PASS}"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro   # SQL init scripts
    networks:
      - payroll_net
    restart: always
    shm_size: 256mb

  valkey:
    image: valkey/valkey:7.2-alpine
    command: valkey-server --save 60 1 --loglevel warning --requirepass "${VALKEY_PASS}"
    volumes:
      - valkey_data:/data
    networks:
      - payroll_net
    restart: always


  frontend_builder:
    # Build-time only; not a runtime service
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./frontend:/app
      - frontend_build:/app/dist
    command: sh -c "npm ci && npm run build"
    profiles:
      - build

volumes:
  postgres_data:
  valkey_data:
  uploads:
  reports:
  frontend_build:

networks:
  payroll_net:
    driver: bridge
```

### 16.3 .env File (template — never commit actual values)

```env
DB_ROOT_PASS=changeme_root
DB_APP_PASS=changeme_app
JWT_SECRET_KEY=changeme_jwt_min32chars
VALKEY_PASS=changeme_valkey
FLOWER_PASS=changeme_flower
```

### 16.4 Backend Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# WeasyPrint system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangoft2-1.0-0 libgdk-pixbuf2.0-0 \
    libffi-dev libcairo2 libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create upload and report directories
RUN mkdir -p /app/uploads /app/reports

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### 16.5 Key requirements.txt Packages

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy[asyncio]==2.0.30
alembic==1.13.1
asyncpg==0.29.0
psycopg2-binary==2.9.9        # for Celery result backend
pydantic==2.7.0
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
celery==5.4.0
redis==5.0.4                  # Valkey-compatible; redis-py client works with Valkey
openpyxl==3.1.3
weasyprint==61.2
python-dateutil==2.9.0
```

### 16.6 Database Initialisation Scripts (`/db/init/`)

Executed in alphabetical order by PostgreSQL on first start:
- `01_extensions.sql` — `CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent;`
- `02_roles.sql` — create `payroll_app_role`; grant permissions
- `03_schema.sql` — all CREATE TABLE statements
- `04_indexes.sql` — all CREATE INDEX statements
- `05_rls.sql` — Row Level Security policies
- `06_views.sql` — `payroll_all` view
- `07_triggers.sql` — audit log triggers on all LK_ tables
- `08_seed_data.sql` — seed all 7 lookup tables with data from LaoPayrollToolkit_v5

### 16.7 Production Checklist

- [ ] Change all passwords in `.env`
- [ ] TLS certificate mounted in `/nginx/certs/`
- [ ] Valkey `requirepass` set (all clients use password in connection string)
- [ ] PostgreSQL `pg_hba.conf` restricts connections to `payroll_net` only
- [ ] Alembic migrations run: `docker compose exec api alembic upgrade head`
- [ ] Seed data loaded: `docker compose exec postgres psql -U postgres payroll_db -f /docker-entrypoint-initdb.d/08_seed_data.sql`
- [ ] Test bulk upload with sample 3-row Excel file
- [ ] Test payroll run for 1 employee before full run
- [ ] Verify Celery beat job schedule in Flower UI
- [ ] Confirm audit log trigger fires on LK_ table update

---


---

## 17. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Employee list load (50 rows) | < 1 second |
| Employee search response | < 500ms |
| Payroll calculation — 500 employees | < 10 seconds |
| Payroll calculation — 10,000 employees | < 3 minutes (async Celery job) |
| Synchronous report generation | < 15 seconds |
| Async report (> 5,000 rows) | Download ready within 2 minutes |
| Lookup API (Valkey cached) | < 100ms |
| Dashboard KPI load (React + Recharts) | < 1 second |
| DB connection pool | PgBouncer NOT required at Phase 1 scale; SQLAlchemy pool_size=10, max_overflow=20 |
| Concurrent users | 50 simultaneous users supported in Phase 1 |
| Uptime target | 99.5% during government working hours (08:00–17:00, UTC+7, Mon–Fri) |
| Maintenance window | Saturdays 01:00–05:00 UTC+7 |
| DB backup | `pg_dump` daily; retain 30 daily snapshots; 12 monthly; store on separate volume |
| Log retention | Application logs retained 90 days; archive to compressed file |
| Browser support | Chrome 110+, Firefox 110+, Edge 110+; desktop and tablet (1024px+) only |
| Security: XSS | JWT in memory; no localStorage; CSP header via Nginx |
| Security: CSRF | SameSite=Strict on refresh cookie; CORS origin whitelist in FastAPI |
| Security: SQL Injection | SQLAlchemy ORM parameterised queries; no raw string concatenation in queries |
| Security: File upload | MIME + extension validation; openpyxl parse in isolated function; reject `.xlsm` macro files; max 10MB |
| Security: Audit log | Append-only enforced by PostgreSQL role permissions |
| Duplicate check API response | < 200ms (Valkey cache) |
| Employee export — Excel ≤ 100 rows | < 5 seconds synchronous |
| Employee export — Excel > 100 rows | Celery async, ready < 2 minutes |
| Employee export — PDF ≤ 1,000 rows | < 15 seconds |
| Online grid — duplicate check per cell | < 200ms |
| Online grid — max rows | 200 rows per session |

---

## 18. Error Codes and Handling

All API errors return:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERR_EMP_NOT_FOUND",
    "message": "Employee LAO00999 does not exist",
    "field": "employee_code"
  }
}
```

| Code | HTTP | Trigger |
|---|---|---|
| `ERR_AUTH_INVALID_CREDENTIALS` | 401 | Wrong username or password |
| `ERR_AUTH_ACCOUNT_LOCKED` | 403 | Too many failed logins |
| `ERR_AUTH_TOKEN_EXPIRED` | 401 | JWT access token expired |
| `ERR_AUTH_FORBIDDEN` | 403 | Role does not permit this action |
| `ERR_AUTH_MINISTRY_SCOPE` | 403 | User not authorised for this ministry |
| `ERR_EMP_NOT_FOUND` | 404 | Employee code does not exist |
| `ERR_EMP_CODE_DUPLICATE` | 409 | Employee code already exists |
| `ERR_EMP_EMAIL_DUPLICATE` | 409 | Email already in use |
| `ERR_EMP_CSC_DUPLICATE` | 409 | Civil Service Card ID already in use |
| `ERR_EMP_BANK_ACCT_DUPLICATE` | 409 | Bank account number already in use |
| `ERR_EMP_INVALID_CODE_FORMAT` | 400 | Employee code pattern mismatch |
| `ERR_EMP_INVALID_DOB` | 400 | Date of birth age range violation |
| `ERR_EMP_INVALID_JOINING` | 400 | Joining date before minimum age or in future |
| `ERR_EMP_FK_MINISTRY` | 400 | Ministry not in lk_org_master |
| `ERR_EMP_FK_PROVINCE` | 400 | Province not in lk_location_master |
| `ERR_EMP_FK_BANK` | 400 | Bank not in lk_bank_master |
| `ERR_EMP_FK_POSITION_LEVEL` | 400 | Position level not in lk_allowance_rates |
| `ERR_EMP_CODE_NOT_FOUND` | 400 | Bulk upload: update code not found |
| `ERR_PAYROLL_MONTH_LOCKED` | 409 | Cannot modify locked month |
| `ERR_PAYROLL_FUTURE_MONTH` | 400 | Cannot run payroll for future month |
| `ERR_PAYROLL_NEGATIVE_NET` | 422 | Net salary < 0 |
| `ERR_PAYROLL_BASIC_MISMATCH` | 422 | Basic salary formula mismatch |
| `ERR_PAYROLL_SSO_MISMATCH` | 422 | SSO formula mismatch |
| `ERR_PAYROLL_JOB_NOT_FOUND` | 404 | Celery job ID not found |
| `ERR_PAYROLL_NOT_APPROVED` | 409 | Month must be approved before locking |
| `ERR_UPLOAD_INVALID_FORMAT` | 400 | Not a valid .xlsx file |
| `ERR_UPLOAD_TOO_LARGE` | 413 | File > 10MB |
| `ERR_UPLOAD_SESSION_EXPIRED` | 410 | Upload session > 30 minutes old |
| `ERR_UPLOAD_SESSION_NOT_FOUND` | 404 | Session ID does not exist |
| `ERR_UPLOAD_MACRO_DETECTED` | 400 | .xlsm or VBA macro content detected |
| `ERR_MASTER_KEY_IMMUTABLE` | 400 | Attempt to change locked key field |
| `ERR_ARCHIVE_MONTH_NOT_LOCKED` | 400 | Cannot archive unlocked month |
| `WARN_EXP_OUT_OF_RANGE` | 200 | prior_experience_years > 40 (warning in response, not error) |
| `ERR_VALIDATION` | 400 | Generic; `field` key specifies which field failed |
| `ERR_INTERNAL` | 500 | Unexpected error; full stack trace logged server-side; do NOT expose to client |
| `ERR_EMP_SSO_DUPLICATE` | 409 | SSO number already in use |
| `ERR_EMP_OWNERSHIP_DENIED` | 403 | Edit denied by ownership rule |
| `ERR_BATCH_TOO_LARGE` | 400 | Batch POST > 200 rows |
| `ERR_EXPORT_TOO_LARGE` | 400 | PDF export > 1,000 rows |
| `ERR_SCOPE_NOT_FOUND` | 403 | Manager has no scope assigned |
| `ERR_MANAGER_SCOPE_DUPLICATE` | 409 | Manager scope (user+location+dept) already exists |

---

## 19. Open Items

| # | Item | Decision |
|---|---|---|
| OI-01 | Manager scope & employee assignment | **RESOLVED:** Scope is location+department based. `manager_scope` table maps Manager user to (location, department) pairs. All employees whose `service_province` matches location AND `department_name` matches department automatically fall under that Manager — no explicit tagging needed. Scope resolved at query time. Department Officers assign Managers to Location+Department. Manager list has no pre-loaded list — Admin can upload a manager list OR Managers can self-register via the same self-registration flow as employees (with `ROLE_MANAGER` assigned by Admin after registration). |
| OI-02 | ROLE_EMPLOYEE self-registration flow | **RESOLVED:** Self-registration screen at `/register` (public route, no auth required). Fields: SSO Number, Full Name, Email, Phone Number, Location (dropdown from `lk_location_master`), Department (dependent dropdown from `lk_org_master` filtered by location). On submit: creates `app_user` (`ROLE_EMPLOYEE`, `registration_status=PENDING`) + employee stub record (`is_active=false`, `is_complete=false`). Manager for that location+department is notified (in-app notification, no email required in Phase 1). Manager approves → `app_user.registration_status` = `ACTIVE`, `employee.is_active` = `true`. Admin can create and activate employee accounts directly bypassing the approval flow. |
| OI-03 | AG Grid licence | **CLOSED:** AG Grid Community **version 33** + `ModuleRegistry` / `AllCommunityModule` in use; row limit 200 per session. |
| OI-04 | Superset removal from docker-compose | **CLOSED:** Dashboard is React + Recharts; Superset is **not** part of the documented delivery UI. Infrastructure may still run a Superset container for legacy experiments — **not** required for payroll module behaviour. |
| OI-05 | Password policy for ROLE_EMPLOYEE | **CLOSED:** Same `force_password_change` and auth flows as other roles; temp password on admin-created accounts. |
| OI-06 | Master employee count freshness | **OPEN (low):** `GET /master/employee-counts` is Valkey-cached (300s). Optional future improvement: invalidate cache on employee INSERT/UPDATE/DELETE if near-real-time counts are required. |

---

*Document Version 4.1 — Development Team Only — Cursor-Compatible Format*
*Phase 4 implementation reflected in §4.3, §5.6–§5.8, §6.3, §10, §12, §13, §19. Open items OI-03 — OI-05 closed; OI-06 optional enhancement listed.*
*Source: LaoPayrollToolkit_v5.xlsx | Payroll_Metadata_STTM.xlsx*
*Rates: MoF No. 4904/MOF (Dec 2025) | SSO/MLSW Decree | GDT PIT Circular | MoHA Decree 292/GoL 2021*
