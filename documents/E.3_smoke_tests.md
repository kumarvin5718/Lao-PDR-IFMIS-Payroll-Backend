# E.3 Smoke tests (post-deployment)

Run these **after** the API is deployed (and DB seeded) to confirm **audit trail** and **user administration** are wired end-to-end before Slice 3.

**Convention**

- Base URL: `API=https://<host>/api/v1` (local example: `http://127.0.0.1:8000/api/v1`).
- Obtain a JWT per role via `POST /api/v1/auth/login` and set env vars, e.g.  
  `FINANCE_TOKEN`, `HR_TOKEN`, `AUDITOR_TOKEN`, `ADMIN_TOKEN`.
- Send header: `Authorization: Bearer <token>`.

---

## 1 — Audit log (empty filters)

| Field | Value |
|--------|--------|
| **Action** | `GET /api/v1/reports/audit-log` |
| **As** | `ROLE_FINANCE` (`$FINANCE_TOKEN`) |

**Expected:** HTTP **200**; envelope `success: true`; `data` is an array; `pagination.total >= 0`.

```bash
curl -sS -H "Authorization: Bearer $FINANCE_TOKEN" \
  "$API/reports/audit-log"
```

---

## 2 — Audit log (trigger + filter)

| Field | Value |
|--------|--------|
| **Action** | `PUT /api/v1/master/allowance-rates/{name}` with a valid body, then `GET /api/v1/reports/audit-log?table=lk_allowance_rates` |
| **As** | **Finance or Admin** for PUT (`ROLE_FINANCE_PLUS`); **Finance / Admin / Auditor** for GET |

**Expected:** A **new** row in `audit_log` for `table_name = lk_allowance_rates`; `changed_by` matches the acting user’s identity as stored in the audit pipeline (often admin username / display name per DB trigger).

Use a real `allowance_name` from `GET /api/v1/master/allowance-rates`. Example shape for PUT depends on your `AllowanceRateUpdate` schema.

```bash
curl -sS -X PUT -H "Authorization: Bearer $FINANCE_TOKEN" -H "Content-Type: application/json" \
  -d '{"rate_value": "1", ...}' \
  "$API/master/allowance-rates/<ALLOWANCE_NAME>"

curl -sS -H "Authorization: Bearer $FINANCE_TOKEN" \
  "$API/reports/audit-log?table=lk_allowance_rates&limit=50"
```

---

## 3 — Audit log (HR blocked)

| Field | Value |
|--------|--------|
| **Action** | `GET /api/v1/reports/audit-log` |
| **As** | `ROLE_HR` (`$HR_TOKEN`) |

**Expected:** HTTP **403**; error code **`ERR_AUTH_FORBIDDEN`** (audit log view is restricted to Finance, Admin, Auditor).

```bash
curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $HR_TOKEN" \
  "$API/reports/audit-log"
```

---

## 4 — Audit log export (async)

| Field | Value |
|--------|--------|
| **Action** | `GET /api/v1/reports/audit-log?export=xlsx` |
| **As** | `ROLE_AUDITOR` (`$AUDITOR_TOKEN`) |

**Expected:** HTTP **200**; `data.job_id` present. **Celery worker** must be running. Poll:

`GET /api/v1/reports/jobs/{job_id}`

**Expected when finished:** `state` is **`SUCCESS`** (not a literal `status=done` string); `result` contains **`file_path`** and **`rows`**. Download via `GET /api/v1/reports/download/{filename}` (basename only, `.xlsx`).

```bash
JOB=$(curl -sS -H "Authorization: Bearer $AUDITOR_TOKEN" \
  "$API/reports/audit-log?export=xlsx" | jq -r '.data.job_id')

curl -sS -H "Authorization: Bearer $AUDITOR_TOKEN" \
  "$API/reports/jobs/$JOB"
```

---

## 5 — User list

| Field | Value |
|--------|--------|
| **Action** | `GET /api/v1/admin/users` |
| **As** | `ROLE_ADMIN` (`$ADMIN_TOKEN`) |

**Expected:** HTTP **200**; `data` array includes the seeded admin user (and others as applicable).

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/users?page=1&limit=50"
```

---

## 6 — Create user (HR + ministry)

| Field | Value |
|--------|--------|
| **Action** | `POST /api/v1/admin/users` |
| **As** | `ROLE_ADMIN` |

**Body (example):** valid `ROLE_HR` and `ministry_scope` (must match a ministry string your org master allows).

**Expected:** HTTP **201**; `data.temp_password` present; user appears on `GET /api/v1/admin/users`.

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "username": "smoke_hr_01",
    "full_name": "Smoke HR",
    "email": "smoke_hr_01@example.com",
    "role": "ROLE_HR",
    "ministry_scope": "<MINISTRY_NAME>",
    "preferred_language": "en"
  }' \
  "$API/admin/users"
```

---

## 7 — Create user (HR without scope)

| Field | Value |
|--------|--------|
| **Action** | `POST /api/v1/admin/users` with `ROLE_HR` and **no** `ministry_scope` |

**Expected:** HTTP **400**; code **`ERR_USER_MINISTRY_REQUIRED`**.

---

## 8 — Update user (role change clears scope)

| Field | Value |
|--------|--------|
| **Action** | `PUT /api/v1/admin/users/{user_id}` — set `role` from `ROLE_HR` to `ROLE_FINANCE` (omit or null ministry as appropriate) |
| **As** | `ROLE_ADMIN` |

**Expected:** HTTP **200**; response user has **`ministry_scope: null`**.

```bash
curl -sS -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"role": "ROLE_FINANCE", "ministry_scope": null}' \
  "$API/admin/users/<USER_UUID>"
```

---

## 9 — Reset password

| Field | Value |
|--------|--------|
| **Action** | `POST /api/v1/admin/users/{user_id}/reset-password` |
| **As** | `ROLE_ADMIN` |

**Expected:** HTTP **200**; `data.temp_password` present; in DB, `app_user.force_password_change = true` for that user (verify with SQL or admin tooling).

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/users/<USER_UUID>/reset-password"
```

---

## 10 — Login history

| Field | Value |
|--------|--------|
| **Action** | Log in successfully as the target user, then `GET /api/v1/admin/users/{user_id}/login-history` as **Admin** |

**Expected:** HTTP **200**; at least one row with **`login_at`** set; **`ip_address`** populated when the client IP is forwarded correctly (e.g. `X-Forwarded-For` behind a proxy).

**Implementation note:** The current API returns `id`, `login_at`, `ip_address`, `user_agent`. There is **no** `event_type` field; rows in `app_login_history` represent **successful** logins only.

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/users/<USER_UUID>/login-history"
```

---

## 11 — Non-admin blocked from user list

| Field | Value |
|--------|--------|
| **Action** | `GET /api/v1/admin/users` |
| **As** | `ROLE_FINANCE` (`$FINANCE_TOKEN`) |

**Expected:** HTTP **403** (`ERR_AUTH_FORBIDDEN`).

```bash
curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $FINANCE_TOKEN" \
  "$API/admin/users"
```

---

## Checklist

| # | Area | OK |
|---|------|-----|
| 1 | Audit log list (Finance) | ☐ |
| 2 | Audit row after master PUT | ☐ |
| 3 | HR blocked from audit log | ☐ |
| 4 | Export job + Celery + download | ☐ |
| 5 | Admin user list | ☐ |
| 6 | Create HR + scope | ☐ |
| 7 | ERR_USER_MINISTRY_REQUIRED | ☐ |
| 8 | Role change clears ministry | ☐ |
| 9 | Reset password + `force_password_change` | ☐ |
| 10 | Login history row | ☐ |
| 11 | Finance blocked from admin users | ☐ |
