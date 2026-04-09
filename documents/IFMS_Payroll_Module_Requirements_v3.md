# IFMS Payroll Module — Software Requirements Document
### Lao PDR Government | Integrated Financial Management System
**Version:** 3.0 | **Date:** March 2026 | **Audience:** Development Team Only | **Status:** Active

> **Purpose:** This document is the single source of truth for development. It is intended for use in Cursor and other AI-assisted coding tools. All technology decisions are finalised — no open options remain. Business-level descriptions have been minimised in favour of technical specification.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope](#2-scope)
3. [Technology Stack — Finalised](#3-technology-stack--finalised)
4. [User Roles and Login](#4-user-roles-and-login)
5. [Module Structure — Screens and Functionality](#5-module-structure--screens-and-functionality)
6. [Excel-Based Bulk Upload Feature](#6-excel-based-bulk-upload-feature)
7. [Calculation Logic — Detailed](#7-calculation-logic--detailed)
8. [Search Implementation](#8-search-implementation)
9. [Reports and Dashboards — Apache Superset](#9-reports-and-dashboards--apache-superset)
10. [Data Validation Rules](#10-data-validation-rules)
11. [Database Schema — Developer Detail](#11-database-schema--developer-detail)
12. [API Endpoints — Full Catalogue](#12-api-endpoints--full-catalogue)
13. [Internationalisation — English and Lao Script](#13-internationalisationi18n--english-and-lao-script)
14. [Data Archival Strategy](#14-data-archival-strategy)
15. [Deployment — Docker Production](#15-deployment--docker-production)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Error Codes and Handling](#17-error-codes-and-handling)
18. [Open Items — All Resolved](#18-open-items--all-resolved)

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

**In Scope:**
- Employee master data (manual form entry + Excel bulk upload)
- Monthly payroll calculation (basic salary, 12 standard allowances, 3 free allowance fields, SSO, PIT, 2 free deduction fields, net salary)
- 7 master lookup table management screens with full audit trail
- Role-based access control with ministry-level data scoping
- Bilingual UI — English and Lao script
- Reports and dashboards via Apache Superset (embedded)
- Data archival: active 3 years → archive indefinitely; retrieval on demand

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
| Valkey 7.2 | BSD 3-Clause | ✓ |
| Celery | BSD 3-Clause | ✓ |
| openpyxl | MIT | ✓ |
| WeasyPrint | BSD 3-Clause | ✓ |
| Apache Superset | Apache 2.0 | ✓ |
| Nginx | BSD 2-Clause | ✓ |
| Docker Engine | Apache 2.0 | ✓ |
| pg_trgm (PostgreSQL extension) | PostgreSQL Licence | ✓ |
| pydantic | MIT | ✓ |
| python-jose (JWT) | MIT | ✓ |
| passlib (password hashing) | BSD | ✓ |

> **Note on Redis vs Valkey:** Redis 7.4+ uses RSALv2 + SSPL dual licence — not compatible with Apache 2.0 delivery bundles. **Valkey 7.2** is the Linux Foundation-maintained BSD 3-Clause fork; it is a drop-in replacement. All caching and task broker code targets Valkey. Docker image: `valkey/valkey:7.2`.

> **Note on file storage:** MinIO uses AGPL v3 — not safe for client delivery. File storage (uploaded Excel files, generated PDF reports) uses **local filesystem mounted as Docker named volumes**. At the scale of this application (< 10,000 files), no object store is required.

---

### 3.2 Full Stack Decision Table

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Reverse Proxy** | Nginx | 1.25 (stable) | TLS termination, static asset serving, API proxy, Superset proxy |
| **Frontend** | React + TypeScript | React 18, TS 5.x | Single-page application |
| **Frontend UI** | Ant Design | 5.x | Component library; supports Lao script rendering |
| **Frontend State / Data** | TanStack Query | v5 | Server-state management, caching, pagination |
| **Frontend Forms** | React Hook Form + Zod | Latest stable | Form state and schema validation |
| **Frontend Charts** | Recharts | 2.x | Dashboard inline widgets |
| **Frontend i18n** | react-i18next | 14.x | Bilingual EN/Lao |
| **Frontend Excel preview** | SheetJS Community (xlsx) | Latest | Client-side parse of upload preview (first 5 rows) |
| **Backend API** | FastAPI | 0.111+ | REST API, async, OpenAPI auto-docs |
| **Backend ORM** | SQLAlchemy (Object Relational Mapper) | 2.x (async) | Database access layer; models map to PostgreSQL tables |
| **DB Migrations** | Alembic | 1.13+ | Version-controlled schema migrations; tied to SQLAlchemy models |
| **Data Validation** | pydantic | v2 | Request/response schema validation; integrated with FastAPI |
| **Authentication** | python-jose + passlib | Latest | JWT (access + refresh), bcrypt password hashing |
| **Task Queue** | Celery | 5.x | Async payroll runs, bulk upload processing, report exports, archival jobs |
| **Task Broker** | Valkey 7.2 | 7.2 | Message broker for Celery; also serves as API cache backend |
| **Task Result Backend** | PostgreSQL (via SQLAlchemy) | — | Celery task results stored in DB; no separate result store needed |
| **Database** | PostgreSQL | 16 | Primary relational database |
| **Search** | pg_trgm + tsvector (PostgreSQL built-in) | Built into PG 16 | Full-text and trigram search; no external search engine |
| **Excel — Template Gen** | openpyxl | 3.x | Generate downloadable upload templates with dropdowns and styling |
| **Excel — Upload Parse** | openpyxl | 3.x | Server-side parse of uploaded employee Excel files |
| **PDF Generation** | WeasyPrint | 60+ | Render payslips and reports as PDF from HTML/CSS templates |
| **Reports & Dashboards** | Apache Superset | 4.x | Embedded dashboards, ad-hoc SQL charts, scheduled reports |
| **File Storage** | Docker named volume (local filesystem) | — | Excel uploads, generated PDFs; path stored in DB |
| **Container Runtime** | Docker Engine + Docker Compose | Docker 26+ | Development and production deployment |
| **Deployment** | Docker Compose (production) | v2 | See Section 15 |

---

## 4. User Roles and Login

### 4.1 Role Definitions

| Role Code | Display Name | Data Scope |
|---|---|---|
| `ROLE_HR` | HR Officer | Own ministry only |
| `ROLE_FINANCE` | Finance Officer | All ministries |
| `ROLE_ADMIN` | System Admin | All ministries |
| `ROLE_AUDITOR` | Auditor | All ministries — read-only |
| `ROLE_MINISTRY_HEAD` | Ministry Head | Own ministry — read-only |

### 4.2 Permission Matrix

| Action | HR | Finance | Admin | Auditor | Ministry Head |
|---|---|---|---|---|---|
| View Employee List | Own | All | All | All | Own |
| Add / Edit Employee | Own | All | All | ✗ | ✗ |
| Deactivate Employee | Own | All | All | ✗ | ✗ |
| Excel Bulk Upload | Own | All | All | ✗ | ✗ |
| Run Monthly Payroll | ✗ | All | All | ✗ | ✗ |
| Edit Free Fields (Payroll) | ✗ | All | All | ✗ | ✗ |
| Approve Payroll | ✗ | ✗ | All | ✗ | Own ministry |
| Lock Payroll Month | ✗ | ✗ | All | ✗ | ✗ |
| Manage Lookup Tables | ✗ | All | All | ✗ | ✗ |
| Manage Users | ✗ | ✗ | All | ✗ | ✗ |
| View Reports (Superset) | Own | All | All | All | Own |
| Export Reports | Own | All | All | All | ✗ |
| View Audit Trail | ✗ | All | All | All | ✗ |
| View Archived Payroll | ✗ | All | All | All | ✗ |
| Trigger Archival | ✗ | ✗ | All | ✗ | ✗ |

### 4.3 Login Technical Specification

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{ "username": "string", "password": "string" }
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "user_id": "uuid",
    "full_name": "string",
    "role": "ROLE_HR",
    "ministry_scope": "Ministry of Health (MoH)",
    "preferred_language": "en"
  }
}
```

**JWT Access Token Payload:**
```json
{
  "sub": "user_id_uuid",
  "role": "ROLE_HR",
  "ministry_scope": "MOH",
  "iat": 1700000000,
  "exp": 1700001800
}
```

**Token strategy:**
- Access token TTL: 30 minutes; stored in React memory (not localStorage, not sessionStorage)
- Refresh token TTL: 8 hours; HTTP-only, Secure, SameSite=Strict cookie
- Refresh endpoint: `POST /api/auth/refresh` — reads cookie, issues new access token
- Logout endpoint: `POST /api/auth/logout` — server-side refresh token invalidation (stored in `revoked_tokens` table or Valkey SET with TTL)
- Failed login lockout: 5 consecutive failures → `locked_until = now() + 15 minutes`; `ERR_AUTH_ACCOUNT_LOCKED` returned
- Rate limit on `/api/auth/login`: 10 req/min per IP (Nginx `limit_req`)

**PostgreSQL Row-Level Security (RLS) for ministry scoping:**

```sql
-- Enable RLS on employee and payroll_monthly
ALTER TABLE employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_monthly ENABLE ROW LEVEL SECURITY;

-- Policy: ROLE_HR and ROLE_MINISTRY_HEAD can only see their own ministry
CREATE POLICY ministry_scope_policy ON employee
  USING (
    current_setting('app.current_role', true) IN ('ROLE_FINANCE', 'ROLE_ADMIN', 'ROLE_AUDITOR')
    OR ministry_name = current_setting('app.current_ministry', true)
  );
```

FastAPI middleware sets `SET LOCAL app.current_role = 'ROLE_HR'` and `SET LOCAL app.current_ministry = 'MOH'` at the start of each request transaction using the decoded JWT claims.

---

## 5. Module Structure — Screens and Functionality

### 5.1 Employee Master

**Route:** `/employees`

#### 5.1.1 Employee List

- Server-side pagination: 50 rows/page; `GET /api/employees?page=1&limit=50`
- Default sort: `employee_code ASC`
- Search bar: trigram + full-text search across employee_code, first_name, last_name, civil_service_card_id (see Section 8)
- Filter panel: Ministry (dropdown), Department (dependent dropdown), Grade (1–10), Employment Type, Province, Status (Active/Inactive)
- Columns: Employee Code, Full Name, Ministry, Department, Grade/Step, Position, Province, Employment Type, Status, Actions
- Actions per row: View (read-only form), Edit (editable form), Deactivate (soft-delete with confirm dialog)
- Bulk actions toolbar (appears when rows selected): Export to Excel, Bulk Deactivate
- Top-right buttons: **"Add Employee"** (opens form), **"Bulk Upload"** (opens upload modal)

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
- `GET /api/lookups/departments?ministry_key=MOH`
- `GET /api/lookups/divisions?dept_key=MOH_CUR`
- `GET /api/lookups/org-derived?ministry_name=Ministry+of+Health+(MoH)` → `{profession_category, is_na_member, field_allowance_type}`

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
- `GET /api/lookups/provinces?country_key=LAO`
- `GET /api/lookups/districts?province_key=VTE`
- `GET /api/lookups/location-derived?province=Vientiane+Capital` → `{is_remote, is_hazardous}`

**Tab 6 — Bank Details** (cascading dropdowns)

| Field | DB Column | Source | Derived |
|---|---|---|---|
| Bank Name | `bank_name` | LK_BANK_MASTER | No |
| Bank Branch | `bank_branch` | Filtered by bank | No |
| Bank Branch Code | `bank_branch_code` | LK_BANK_MASTER.branch_code | ✓ |
| Bank Account Number | `bank_account_no` | Manual | No |
| SWIFT / BIC Code | `swift_code` | LK_BANK_MASTER.swift_code | ✓ |

Cascade API: `GET /api/lookups/branches?bank_key=BCEL`

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
GET    /api/employees                     List + filters + pagination
POST   /api/employees                     Create new employee
GET    /api/employees/{employee_code}     Get single record
PUT    /api/employees/{employee_code}     Full update
PATCH  /api/employees/{employee_code}     Partial update
DELETE /api/employees/{employee_code}     Soft-delete (is_active = false)
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

#### 5.2.1 Screen Controls

- Month/Year picker — cannot select future months
- Ministry filter (ROLE_HR scoped automatically via RLS)
- "Run Payroll" button → `POST /api/payroll/run`
- "Approve Month" button (Ministry Head for own ministry, Admin for any) → sets `approval_status = 'APPROVED'`
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
POST /api/payroll/run
  Body: { "month": "2026-03", "ministry_filter": null }
  Response: { "job_id": "uuid", "status": "queued" }

GET /api/payroll/jobs/{job_id}   (poll every 3 seconds)
  Response: { "status": "running|done|failed", "records_processed": 450, "errors": [] }
```

Celery worker logic:
1. Fetch all `is_active = true` employees (filtered by ministry if provided)
2. For each employee, run full calculation (see Section 7)
3. UPSERT into `payroll_monthly` using `ON CONFLICT (employee_code, payroll_month) DO UPDATE`
4. Reject upsert if `is_locked = true` for that month; add to `errors` list
5. Write job result to `celery_task_result` table

#### 5.2.4 Payroll Register Grid

Frozen columns: Employee Code, Full Name, Ministry.
All formula columns are read-only.
Free-field columns (Other Allowance 1/2/3, Additional Deduction 1/2) are inline-editable by ROLE_FINANCE.

Columns in order:
`employee_code | full_name | ministry | grade | step | basic_salary | position_allowance | years_service_allowance | teaching_allowance | medical_allowance | na_allowance | hazardous_allowance | remote_allowance | foreign_allowance | fuel_benefit | spouse_benefit | child_benefit | other_allowance_1 (editable + desc) | other_allowance_2 (editable + desc) | other_allowance_3 (editable + desc) | total_allowances | gross_earnings | sso_contribution | taxable_income | pit_amount | addl_deduction_1 (editable + desc) | addl_deduction_2 (editable + desc) | total_deductions | NET SALARY`

Grand totals row pinned at bottom.

---

### 5.3 Master Data Management — 7 Lookup Tables

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

**Route:** `/admin/users` (ROLE_ADMIN only)

User table: see Section 11.3.

- List: username, full name, role, ministry scope, last login, active status
- Create: username, auto-generated temp password (emailed), role, ministry scope (required for ROLE_HR and ROLE_MINISTRY_HEAD)
- Edit: role, ministry scope, active/inactive
- Reset password: generates new temp password; user must change on next login (`force_password_change = true`)
- Login history: last 30 entries per user

---

### 5.5 Audit Trail Viewer

**Route:** `/audit`

Backed by centralised `audit_log` table (populated by PostgreSQL triggers on all LK_ tables).

Filter controls: Table name (dropdown), Date range, Changed by (user search), Circular reference (text search).

Columns: Table | Row Key | Field Changed | Old Value | New Value | Changed By | Changed At | Circular Ref | Remarks

Pagination: 100 rows/page server-side. Export to Excel: max 50,000 rows per export via Celery async job.

---

## 6. Excel-Based Bulk Upload Feature

### 6.1 Two Upload Types

| Type | Template Endpoint | Who Can Use | Purpose |
|---|---|---|---|
| Employee Bulk Upload | `GET /api/bulk-upload/employee/template` | ROLE_HR+ | Insert new or update existing employees |
| Payroll Free-Fields Upload | `GET /api/bulk-upload/payroll-free-fields/template?month=2026-03` | ROLE_FINANCE+ | Bulk-enter Other Allowances and Additional Deductions for a month |

### 6.2 Employee Upload Template Structure

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

### 6.3 Upload Flow (Frontend + Backend)

```
1. User: GET /api/bulk-upload/employee/template
        → Downloads dynamically generated XLSX

2. User fills template offline

3. User: Opens "Bulk Upload" modal on /employees
        → Drags/drops or selects file (.xlsx only, max 10MB)

4. Frontend: Reads first 5 rows via SheetJS for immediate preview
             Sends file to: POST /api/bulk-upload/employee/validate
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
   - "Download Error Report" button (GET /api/bulk-upload/employee/error-report/{session_id})
     → Returns same XLSX with extra column "VALIDATION_RESULT" appended

7. User reviews; optionally downloads and corrects errors; re-uploads

8. User: POST /api/bulk-upload/employee/confirm { "session_id": "uuid" }

9. Backend:
   a. Validate session not expired (30 min TTL)
   b. Commit all valid + warning rows to employee table
   c. Skip error rows
   d. Set session status = 'CONFIRMED'
   e. Return: { imported: 118, skipped: 2, employee_codes: [...newly created codes...] }
```

### 6.4 Insert vs Update Logic

```python
if row["employee_code"] is None or row["employee_code"] == "":
    # New employee: auto-generate code; INSERT
else:
    employee = db.get(Employee, row["employee_code"])
    if employee is None:
        raise UploadRowError("ERR_EMP_CODE_NOT_FOUND", row=row_number)
    # Update: UPDATE employee SET ... WHERE employee_code = X
```

### 6.5 Upload Session Table

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

### 6.6 Payroll Free-Fields Upload

Template endpoint: `GET /api/bulk-upload/payroll-free-fields/template?month=2026-03`

Backend pre-fills Employee Code and Employee Name for all active employees. User fills amount and description columns.

**Template columns:** Employee Code (locked) | Employee Name (locked) | Other Allowance 1 Amount | Other Allowance 1 Description | Other Allowance 2 Amount | Other Allowance 2 Description | Other Allowance 3 Amount | Other Allowance 3 Description | Additional Deduction 1 Amount | Additional Deduction 1 Description | Additional Deduction 2 Amount | Additional Deduction 2 Description

Validations: Employee code exists; amounts ≥ 0 (null treated as 0); month not locked; no duplicate employee codes in file.

---

## 7. Calculation Logic — Detailed

All calculation functions live in `app/services/payroll_calculator.py`. They are pure functions with no database I/O — all lookup data is passed in as parameters pre-fetched from Valkey cache or DB.

### 7.1 Grade Derivation

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

### 7.2 Basic Salary

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

### 7.3 Position Allowance

```python
def calc_position_allowance(position_level: str, rates: dict) -> Decimal:
    return Decimal(rates.get(position_level, 0))
    # rates dict keyed by allowance_name from lk_allowance_rates
```

### 7.4 Years of Service Allowance

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

### 7.5 Teaching Allowance

```python
def calc_teaching_allowance(field_allowance_type: str, basic_salary: Decimal, rates: dict) -> Decimal:
    if field_allowance_type == "Teaching":
        rate = Decimal(str(rates["Teaching Allowance Rate — % of Basic Salary"]))  # 0.20
        return Decimal(round(basic_salary * rate, 0))
    return Decimal(0)
```

### 7.6 Remote Area Allowance

```python
def calc_remote_allowance(is_remote_area: bool, basic_salary: Decimal, rates: dict) -> Decimal:
    if is_remote_area:
        rate = Decimal(str(rates["Remote / Difficult Area Allowance Rate — % of Basic Salary"]))  # 0.25
        return Decimal(round(basic_salary * rate, 0))
    return Decimal(0)
```

### 7.7 Remaining Flat-Rate Allowances

```python
medical_allowance  = Decimal(rates["Medical Personnel Allowance"]) if field_allowance_type == "Medical" else Decimal(0)
na_allowance       = Decimal(rates["National Assembly (NA) Member Allowance"]) if is_na_member else Decimal(0)
hazardous_allow    = Decimal(rates["Hardship and Hazardous Jobs Allowance"]) if is_hazardous_area else Decimal(0)
foreign_allow      = Decimal(rates["Foreign Representative Living Allowance (LAK equivalent)"]) if is_foreign_posting else Decimal(0)
fuel_benefit       = Decimal(rates["Fuel Benefit — High Ranking Officials (Grade 6)"]) if grade == 6 else Decimal(0)
spouse_benefit     = Decimal(rates["Spouse Benefit"]) if has_spouse else Decimal(0)
child_benefit      = Decimal(rates["Child Benefit (per child, max 3)"]) * min(eligible_children, 3)
```

### 7.8 SSO, PIT and Net

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

### 7.9 PIT Progressive Calculation

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

## 8. Search Implementation

**No external search engine is used.** All search is handled within PostgreSQL 16 using built-in extensions. This eliminates the need for Elasticsearch (SSPL licence) or Typesense (GPL licence).

### 8.1 Extensions Enabled

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### 8.2 Search Index on Employee Table

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

### 8.3 Search Query Pattern

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

### 8.4 FastAPI Implementation

```python
@router.get("/employees")
async def list_employees(
    search: Optional[str] = Query(None, min_length=1, max_length=100),
    page: int = 1,
    limit: int = 50,
    ministry: Optional[str] = None,
    grade: Optional[int] = None,
    employment_type: Optional[str] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    query = select(Employee).where(Employee.is_active == is_active)

    if search and len(search) >= 3:
        search_condition = or_(
            Employee.employee_code.ilike(f"%{search}%"),
            Employee.civil_service_card_id.ilike(f"%{search}%"),
            func.similarity(
                Employee.first_name + " " + Employee.last_name, search
            ) > 0.3
        )
        query = query.where(search_condition).order_by(
            func.similarity(Employee.first_name + " " + Employee.last_name, search).desc()
        )
    elif search:
        query = query.where(
            or_(
                Employee.employee_code.ilike(f"%{search}%"),
                Employee.first_name.ilike(f"%{search}%"),
                Employee.last_name.ilike(f"%{search}%")
            )
        )

    # Apply RLS-equivalent filter in code for defence-in-depth
    if current_user.role in ("ROLE_HR", "ROLE_MINISTRY_HEAD"):
        query = query.where(Employee.ministry_name == current_user.ministry_scope)

    if ministry:
        query = query.where(Employee.ministry_name == ministry)
    if grade:
        query = query.where(Employee.grade == grade)
    if employment_type:
        query = query.where(Employee.employment_type == employment_type)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    results = await db.execute(query.offset((page - 1) * limit).limit(limit))
    return paginated_response(results.scalars().all(), total, page, limit)
```

### 8.5 Payroll Search

Monthly payroll register: same pattern — search by employee_code or name. No fuzzy needed; exact/prefix match sufficient since Finance Officers typically know the employee code.

### 8.6 Audit Log Search

Audit log search: full-text on `table_name`, `row_key`, `changed_by`, `circular_ref` columns using `ILIKE`. Volume is moderate (< 1M rows in 3 years); no additional index needed beyond `idx_audit_table_date`.

---

## 9. Reports and Dashboards — Apache Superset

### 9.1 Why Apache Superset

Apache Superset (Apache 2.0 licence) is embedded as a separate container in the Docker Compose stack. It connects directly to the PostgreSQL database using a read-only `superset_reader` role, ensuring no payroll data is ever written through Superset.

Superset provides:
- Pre-built charts and dashboards configurable without code
- SQL Lab for ad-hoc queries by Finance Officers and Auditors
- Scheduled email delivery of reports
- Role-based dashboard access that mirrors the application roles
- Embeddable iframes served inside the main application UI via Superset's Guest Token API

### 9.2 Superset Deployment

```yaml
# docker-compose.yml excerpt
superset:
  image: apache/superset:4.0.0
  environment:
    SUPERSET_SECRET_KEY: "${SUPERSET_SECRET_KEY}"
    DATABASE_URL: "postgresql+psycopg2://superset_user:${SUPERSET_DB_PASS}@postgres:5432/payroll_db"
  volumes:
    - superset_home:/app/superset_home
  depends_on:
    - postgres
  ports:
    - "8088:8088"   # internal only; proxied via Nginx
```

Nginx proxies `/superset/` → `http://superset:8088/` with appropriate headers.

### 9.3 PostgreSQL Read-Only Role for Superset

```sql
CREATE ROLE superset_reader NOLOGIN;
GRANT CONNECT ON DATABASE payroll_db TO superset_reader;
GRANT USAGE ON SCHEMA public TO superset_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO superset_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO superset_reader;

CREATE USER superset_user WITH PASSWORD '...' IN ROLE superset_reader;
-- superset_user cannot write to any table
```

### 9.4 Superset Roles Mapped to Application Roles

| App Role | Superset Role | Access |
|---|---|---|
| ROLE_FINANCE | `Finance` | All dashboards; SQL Lab; export |
| ROLE_ADMIN | `Admin` | All + Superset admin UI |
| ROLE_AUDITOR | `Auditor` | All dashboards; SQL Lab; export |
| ROLE_HR | `HR` | HR dashboards only (employee analytics); no SQL Lab |
| ROLE_MINISTRY_HEAD | `Ministry Head` | Summary dashboards only; scoped to own ministry via RLS |

Superset Row Level Security (RLS) for ministry scoping:
```sql
-- Superset RLS filter applied to employee table when role = 'Ministry Head'
ministry_name = '{{ current_username_ministry }}'
-- Superset custom filter mapped via Superset RLS rules panel
```

### 9.5 Pre-Built Dashboards and Charts

The following are configured as Superset dashboards. Import configs (JSON) stored in `/superset/dashboard_configs/` in the repo.

**Dashboard 1: Payroll Overview**
- KPI scorecards: Total Gross (current month), Total Net, Total SSO, Total PIT, Employee Count
- Bar chart: Ministry-wise gross earnings (current month)
- Line chart: Month-on-month net salary trend (rolling 12 months)
- Table: Top 10 allowance types by total LAK value
- Filter bar: Month selector, Ministry

**Dashboard 2: Employee Analytics**
- Pie chart: Headcount by employment type
- Bar chart: Headcount by ministry
- Histogram: Grade distribution (1–10)
- Stacked bar: Headcount by ministry × gender
- Table: Years of service bands (0–5, 6–10, 11–20, 21–30, 31+)
- Filter bar: Ministry, Province, Grade

**Dashboard 3: Allowance Distribution**
- Stacked bar: Allowance types as % of gross by ministry
- Table: Count of employees receiving each special allowance (remote, hazardous, foreign, NA, teaching, medical)
- Treemap: Allowance LAK totals by type
- Filter bar: Month, Ministry

**Dashboard 4: Grade & Salary Heatmap**
- Heatmap: Grade (Y-axis 1–10) × Step (X-axis 1–15); cell colour = count of employees; cell value = average basic salary
- Filter: Ministry

**Dashboard 5: Retirement Forecast**
- Bar chart: Monthly retirement count for next 36 months
- Table: Next 20 employees retiring (name, ministry, grade, retirement date)
- Filter: Ministry

**Dashboard 6: PIT & SSO Trend**
- Dual-axis line chart: PIT collected (left axis) and SSO employee contribution (right axis) — rolling 12 months
- Filter: Ministry

### 9.6 Operational Reports via Superset + FastAPI

For formatted operational reports (payslips, payroll registers, ministry summaries), **FastAPI generates the output** (PDF via WeasyPrint, Excel via openpyxl) rather than Superset — Superset is not designed for pixel-perfect document generation.

| Report | Generated By | Format |
|---|---|---|
| Individual Payslip | FastAPI + WeasyPrint | PDF |
| Monthly Payroll Register | FastAPI + openpyxl | Excel / PDF |
| Ministry Payroll Summary | FastAPI + openpyxl | Excel |
| SSO Contribution Report | FastAPI + openpyxl | Excel |
| PIT Report | FastAPI + openpyxl | Excel |
| Upcoming Retirements | FastAPI + openpyxl | Excel |
| Audit Change Log | FastAPI + openpyxl | Excel |
| All analytical charts/dashboards | Apache Superset | Interactive / Export PNG/CSV |
| Ad-hoc SQL results | Superset SQL Lab | CSV / Excel |

Large report exports (> 5,000 rows) triggered as Celery async jobs; user notified when download is ready via polling `GET /api/reports/jobs/{job_id}`.

### 9.7 Guest Token Embedding

To embed Superset dashboards inside the main React application (so users do not navigate to a separate Superset URL):

```python
# FastAPI endpoint
@router.get("/api/superset/guest-token")
async def get_superset_guest_token(
    dashboard_id: str,
    current_user: User = Depends(require_auth)
):
    # Call Superset API with admin credentials to get guest token
    response = requests.post(
        f"{SUPERSET_URL}/api/v1/security/guest_token/",
        headers={"Authorization": f"Bearer {superset_admin_token}"},
        json={
            "user": {"username": current_user.user_id, "first_name": current_user.full_name},
            "resources": [{"type": "dashboard", "id": dashboard_id}],
            "rls": [{"clause": f"ministry_name = '{current_user.ministry_scope}'"}]
              if current_user.ministry_scope else []
        }
    )
    return {"token": response.json()["token"]}
```

Frontend uses `@superset-ui/embedded-sdk` (Apache 2.0) to embed the dashboard:
```tsx
import { embedDashboard } from "@superset-ui/embedded-sdk";
embedDashboard({
  id: dashboardId,
  supersetDomain: "/superset",
  mountPoint: document.getElementById("superset-container")!,
  fetchGuestToken: () => fetch(`/api/superset/guest-token?dashboard_id=${dashboardId}`)
                          .then(r => r.json()).then(d => d.token),
  dashboardUiConfig: { hideTitle: true, hideChartControls: false }
});
```

---

## 10. Data Validation Rules

### 10.1 API-Level Validation (pydantic v2 + FastAPI)

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

### 10.2 Database Constraints

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

---

## 11. Database Schema — Developer Detail

### 11.1 Main Tables

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

### 11.2 Lookup Tables

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

### 11.3 Supporting Tables

```sql
CREATE TABLE app_user (
  user_id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  username              VARCHAR(60)   UNIQUE NOT NULL,
  full_name             VARCHAR(120)  NOT NULL,
  email                 VARCHAR(120)  UNIQUE NOT NULL,
  password_hash         VARCHAR(255)  NOT NULL,
  role                  VARCHAR(30)   NOT NULL
    CHECK (role IN ('ROLE_HR','ROLE_FINANCE','ROLE_ADMIN','ROLE_AUDITOR','ROLE_MINISTRY_HEAD')),
  ministry_scope        VARCHAR(80),  -- NULL = all ministries; ministry_name for scoped roles
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

### 11.4 Indexes

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

## 12. API Endpoints — Full Catalogue

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
POST   /employees                           ROLE_HR+
GET    /employees/{code}                    Auth
PUT    /employees/{code}                    ROLE_HR+
PATCH  /employees/{code}                    ROLE_HR+
DELETE /employees/{code}                    ROLE_HR+      Soft-delete

# BULK UPLOAD
GET    /bulk-upload/employee/template       ROLE_HR+      Returns XLSX file
POST   /bulk-upload/employee/validate       ROLE_HR+      Multipart; returns preview + session_id
GET    /bulk-upload/employee/error-report/{session_id}    ROLE_HR+   Returns XLSX
POST   /bulk-upload/employee/confirm        ROLE_HR+      Body: {session_id}

GET    /bulk-upload/payroll-free-fields/template          ROLE_FINANCE+  ?month=2026-03
POST   /bulk-upload/payroll-free-fields/validate          ROLE_FINANCE+
POST   /bulk-upload/payroll-free-fields/confirm           ROLE_FINANCE+

# PAYROLL
POST   /payroll/run                         ROLE_FINANCE+ Body: {month, ministry_filter?}
GET    /payroll/jobs/{job_id}               ROLE_FINANCE+ Poll job status
GET    /payroll/monthly                     Auth          ?month ?ministry ?page ?limit
PATCH  /payroll/monthly/{code}/{month}      ROLE_FINANCE+ Free fields only
POST   /payroll/approve                     ROLE_FINANCE+ Body: {month, ministry?}
POST   /payroll/lock                        ROLE_ADMIN    Body: {month}
POST   /payroll/unlock                      ROLE_ADMIN    Body: {month, reason}

# LOOKUPS (cascading dropdowns)
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

# MASTER DATA
GET    /master/grade-step                   Auth
PUT    /master/grade-step/{grade}/{step}    ROLE_FINANCE+

GET    /master/allowance-rates              Auth
PUT    /master/allowance-rates/{name}       ROLE_FINANCE+

GET    /master/grade-derivation             Auth
PUT    /master/grade-derivation/{edu}/{exp} ROLE_ADMIN

GET    /master/org                          Auth
POST   /master/org                          ROLE_ADMIN
PUT    /master/org/{ministry_key}/{dept_key} ROLE_ADMIN

GET    /master/location                     Auth
POST   /master/location                     ROLE_ADMIN
PUT    /master/location/{province_key}      ROLE_FINANCE+

GET    /master/bank                         Auth
POST   /master/bank                         ROLE_ADMIN

GET    /master/pit-brackets                 Auth
PUT    /master/pit-brackets/{bracket_no}    ROLE_FINANCE+

# REPORTS (FastAPI-generated files)
GET    /reports/payroll-register            Auth    ?month ?ministry ?export=pdf|xlsx
GET    /reports/payslip/{code}/{month}      Auth    ?export=pdf
GET    /reports/ministry-summary            Auth    ?month ?export=xlsx
GET    /reports/employee-list               Auth    ?ministry ?grade ?province ?export=xlsx
GET    /reports/allowance-breakdown         ROLE_FINANCE+ ?month ?ministry ?export=xlsx
GET    /reports/sso                         ROLE_FINANCE+ ?month ?export=xlsx
GET    /reports/pit                         ROLE_FINANCE+ ?month ?ministry ?export=xlsx
GET    /reports/retirements                 Auth    ?months_ahead=12 ?ministry ?export=xlsx
GET    /reports/foreign-postings            ROLE_FINANCE+ ?month ?export=xlsx
GET    /reports/audit-log                   ROLE_AUDITOR+ ?table ?from ?to ?changed_by ?export=xlsx
GET    /reports/jobs/{job_id}               Auth    Poll async report job

# SUPERSET INTEGRATION
GET    /superset/guest-token                Auth    ?dashboard_id

# ARCHIVE
GET    /archive/payroll                     ROLE_FINANCE+ ?month ?ministry ?page ?limit
POST   /archive/trigger                     ROLE_ADMIN    Manual archival trigger

# ADMIN
GET    /admin/users                         ROLE_ADMIN
POST   /admin/users                         ROLE_ADMIN
PUT    /admin/users/{user_id}               ROLE_ADMIN
GET    /admin/users/{user_id}/login-history ROLE_ADMIN
GET    /admin/system-jobs                   ROLE_ADMIN    Recent job log
```

---

## 13. Internationalisation (i18n) — English and Lao Script

### 13.1 Implementation

- **react-i18next** with JSON translation files:
  - `public/locales/en/translation.json`
  - `public/locales/lo/translation.json`
- Language toggle in top nav bar (EN | ລາວ). User preference persisted in `app_user.preferred_language` and in `localStorage` for pre-login screens
- All JSX uses `t('key')` — zero hardcoded English strings
- HTML `<html lang="en">` / `<html lang="lo">` updates on switch
- `document.documentElement.setAttribute('lang', language)` called on change

### 13.2 Lao Font Setup

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

### 13.3 Numbers and Dates

- All monetary amounts: Western numerals + LAK suffix; formatted via `Intl.NumberFormat('lo-LA')` or a utility function
- Dates: `en-GB` format (DD-MMM-YYYY) for English; Lao month names for Lao UI via i18n key mapping
- DB stores all dates in ISO 8601; formatting is frontend-only

### 13.4 What Must Be Translated

- All navigation menu labels
- All form field labels, placeholders, and helper text
- All dropdown option labels that are user-visible (not DB key values)
- All button labels
- All error messages and validation text
- All table column headers
- All report titles and column headers
- All dashboard widget titles
- All modal titles and confirmation text

### 13.5 What Is NOT Translated (Phase 1)

- DB master data content (Ministry names, Province names, Allowance names) — stored and displayed in English only
- Add `display_name_lo` columns to lk_org_master and lk_location_master in Phase 2 migration if bilingual master data is required

---

## 14. Data Archival Strategy

### 14.1 Policy

| Data | Active Window | Archive Trigger | Destination |
|---|---|---|---|
| PAYROLL_MONTHLY | Most recent 3 years | Payroll month > 3 years old AND is_locked = true | payroll_monthly_archive |
| EMPLOYEE | Never archived | Soft-delete only (is_active = false) | Same table |
| Lookup tables | Never archived | Audit trail captures all historical values | audit_log |

### 14.2 Archival Celery Beat Job

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

### 14.3 Archive Retrieval

All service-layer payroll reads use the `payroll_all` view (unions active + archive). Report queries use the same view with `?include_archived=true` flag.

```python
# FastAPI query: transparent to caller
query = select(payroll_all).where(
    payroll_all.c.payroll_month.between(date_from, date_to)
)
# is_archived column in response indicates whether record came from archive
```

---

## 15. Deployment — Docker Production

### 15.1 Architecture

```
Internet
    │
   [Nginx :443]  ←── TLS termination (Let's Encrypt or self-signed for air-gapped gov env)
    │
    ├── /              → React (static files served by Nginx)
    ├── /api/          → FastAPI :8000
    ├── /superset/     → Apache Superset :8088
    └── /flower/       → Celery Flower :5555 (Admin only)
```

All containers on a private Docker bridge network `payroll_net`. Only Nginx exposes external ports (80, 443).

### 15.2 docker-compose.yml

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
      - superset
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
      SUPERSET_URL: "http://superset:8088"
      SUPERSET_ADMIN_USER: "${SUPERSET_ADMIN_USER}"
      SUPERSET_ADMIN_PASS: "${SUPERSET_ADMIN_PASS}"
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

  superset:
    image: apache/superset:4.0.0
    environment:
      SUPERSET_SECRET_KEY: "${SUPERSET_SECRET_KEY}"
      DATABASE_DIALECT: postgresql
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_DB: payroll_db
      DATABASE_USER: superset_user
      DATABASE_PASSWORD: "${SUPERSET_DB_PASS}"
    volumes:
      - superset_home:/app/superset_home
      - ./superset/superset_config.py:/app/pythonpath/superset_config.py:ro
    depends_on:
      - postgres
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
  superset_home:
  uploads:
  reports:
  frontend_build:

networks:
  payroll_net:
    driver: bridge
```

### 15.3 .env File (template — never commit actual values)

```env
DB_ROOT_PASS=changeme_root
DB_APP_PASS=changeme_app
SUPERSET_DB_PASS=changeme_superset
JWT_SECRET_KEY=changeme_jwt_min32chars
SUPERSET_SECRET_KEY=changeme_superset_min32chars
SUPERSET_ADMIN_USER=superset_admin
SUPERSET_ADMIN_PASS=changeme_superset_admin
VALKEY_PASS=changeme_valkey
FLOWER_PASS=changeme_flower
```

### 15.4 Backend Dockerfile

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

### 15.5 Key requirements.txt Packages

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
httpx==0.27.0                 # For Superset guest token API calls
```

### 15.6 Database Initialisation Scripts (`/db/init/`)

Executed in alphabetical order by PostgreSQL on first start:
- `01_extensions.sql` — `CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent;`
- `02_roles.sql` — create `payroll_app_role`, `superset_reader` roles; grant permissions
- `03_schema.sql` — all CREATE TABLE statements
- `04_indexes.sql` — all CREATE INDEX statements
- `05_rls.sql` — Row Level Security policies
- `06_views.sql` — `payroll_all` view
- `07_triggers.sql` — audit log triggers on all LK_ tables
- `08_seed_data.sql` — seed all 7 lookup tables with data from LaoPayrollToolkit_v5

### 15.7 Production Checklist

- [ ] Change all passwords in `.env`
- [ ] TLS certificate mounted in `/nginx/certs/`
- [ ] Valkey `requirepass` set (all clients use password in connection string)
- [ ] PostgreSQL `pg_hba.conf` restricts connections to `payroll_net` only
- [ ] Superset initial setup: `docker compose exec superset superset init`
- [ ] Import Superset dashboards: `docker compose exec superset superset import-dashboards -p /app/superset_home/dashboards/`
- [ ] Alembic migrations run: `docker compose exec api alembic upgrade head`
- [ ] Seed data loaded: `docker compose exec postgres psql -U postgres payroll_db -f /docker-entrypoint-initdb.d/08_seed_data.sql`
- [ ] Test bulk upload with sample 3-row Excel file
- [ ] Test payroll run for 1 employee before full run
- [ ] Verify Celery beat job schedule in Flower UI
- [ ] Confirm audit log trigger fires on LK_ table update

---

## 16. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Employee list load (50 rows) | < 1 second |
| Employee search response | < 500ms |
| Payroll calculation — 500 employees | < 10 seconds |
| Payroll calculation — 10,000 employees | < 3 minutes (async Celery job) |
| Synchronous report generation | < 15 seconds |
| Async report (> 5,000 rows) | Download ready within 2 minutes |
| Lookup API (Valkey cached) | < 100ms |
| Dashboard widget load (Superset) | < 3 seconds |
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

---

## 17. Error Codes and Handling

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

---

## 18. Open Items — All Resolved

| # | Item | Decision |
|---|---|---|
| OI-01 | Payroll approval workflow | Two-level: Finance Officer runs → Ministry Head/Admin approves → Admin locks. State: `PENDING → APPROVED → LOCKED`. |
| OI-02 | Bank transfer file | Deferred to Phase 2. Account columns in schema. |
| OI-03 | Employee count | Phase 1: 500. Phase 2: ~100,000. Schema handles both. |
| OI-04 | Multi-language | English + Lao script. react-i18next. Noto Serif Lao font. See Section 13. |
| OI-05 | Teaching allowance tiers | Flat 20% of basic salary for all teaching levels (Phase 1). Add level column in Phase 2 migration. |
| OI-06 | Employer SSO tracking | Reference display only (6%); shown in SSO report as informational row. |
| OI-07 | Historical data retention | **Lifetime retention.** Active: 3 years in `payroll_monthly`. After 3 years: move to `payroll_monthly_archive`. Retrieval: `payroll_all` view. Cold tier (compressed files): Phase 2, after 10 years. |

---

*Document Version 3.0 — Development Team Only — Cursor-Compatible Format*
*All technology choices are finalised. No options remain open.*
*Source: LaoPayrollToolkit_v5.xlsx | Payroll_Metadata_STTM.xlsx*
*Rates: MoF No. 4904/MOF (Dec 2025) | SSO/MLSW Decree | GDT PIT Circular | MoHA Decree 292/GoL 2021*
