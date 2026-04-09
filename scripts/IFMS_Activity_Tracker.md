# IFMS — Activity Tracker

**Working assumption:** **6 hours per day** of focused development/ops work.  
**Timeline start:** **Day 1** = first scheduled working day (fill in actual calendar dates locally).

---

## 1. Completed activities

| # | Area | Activity |
|---|------|----------|
| C1 | Payroll | Monthly payroll run (`POST /payroll/run`), calculation pipeline, `payroll_monthly` persistence |
| C2 | Payroll | List/grid, free-field patch, approve / lock / unlock APIs + `PayrollMonthlyPage` UI |
| C3 | Auth & users | JWT login, `app_user` bcrypt storage, admin seed (`db/init/09` / `bootstrap_seed_admin.sql`) |
| C4 | Employees | Employee CRUD, scope rules, bulk upload path, grid entry (AG Grid), duplicate checks |
| C5 | Dashboard | React + Recharts KPIs, filters, scope stats, aggregation APIs |
| C6 | Master data | Lookup tables, manager / dept officer scope masters |
| C7 | Database | `create_dev_tables.py`, lookup seed (`08_seed_data.sql`), audit triggers, `payroll_all` view patch |
| C8 | DevOps | Docker Compose stack, nginx, bootstrap script `scripts/bootstrap_full_database.sh` |
| C9 | Documentation | SRS v4, user manual, AWS EKS deployment guide, runbook, smoke-test doc (may need role refresh) |
| C10 | Frontend | Reports hub `Reports/index.html` structure fix (hero close, `file://` links) |
| C11 | QA | Payroll month lifecycle QA pass; defects logged for fix/retest |

*Adjust rows to match your team’s actual delivered scope.*

---

## 2. Pending activities

| ID | Activity | Notes | Est. (h) |
|----|----------|-------|----------|
| P1 | **Payroll async run** — Celery task for `POST /payroll/run`, job id, polling endpoint + UI | Avoids HTTP timeout for large headcount; `payroll_tasks.py` still TODO | 12–16 |
| P2 | **Payroll correctness** — years-of-service allowance vs SRS (join date + bands); review PIT vs circular | Align `payroll_service` / seed keys with MoF/GDT rules | 12–20 |
| P3 | **Calculator module** — implement `payroll_calculator.py` + unit tests; reduce duplication in `payroll_service` | Matches SRS “pure functions” intent | 16–24 |
| P4 | **Roles** — confirm payroll run/patch allowed roles (e.g. admin-only vs manager) and enforce in API + UI | Align with SRS v4 permission matrix | 4–6 |
| P5 | **Remote DB bootstrap** — verify `bootstrap_full_database.sh` on target env; document `.env` | Unblocks `admin` login on new environments | 4–6 |
| P6 | **EKS / production** — apply deployment doc: ECR, manifests, RDS/ElastiCache, secrets | As needed for go-live | 16–40 |
| P7 | **QA & regression** — payroll scenarios, edge cases, performance sample | Before UAT sign-off | 12–20 |
| P8 | **Docs** — update `E.3_smoke_tests.md` for v4 roles; archive Superset-only SQL if obsolete | Consistency with product | 4–6 |

**Rough total pending (mid-range):** ~**90–150 hours** → at **6 h/day** ≈ **15–25 working days** (single developer). Parallel work or narrower scope reduces calendar time.

---

## 3. Timeline (pending work only) — Day 1 onward @ 6 h/day

Each **day** = **6 hours** on the themes below. Reorder if dependencies change (e.g. P5 before P6).

| Day | Planned focus (6 h) | Primary IDs | Status |
|-----|---------------------|-------------|--------|
| **Day 1** | Payroll async: Celery task skeleton, enqueue from `/payroll/run`, persist job metadata | P1 | completed |
| **Day 2** | Job status API + worker execution path; basic polling from frontend or curl | P1 | completed |
| **Day 3** | UI: run modal → job progress + completion; error handling; invalidate caches | P1 | completed |
| **Day 4** | YoS: spec review vs code; implement join-date-based YoS bands; seed keys check | P2 | completed |
| **Day 5** | PIT cross-check vs GDT brackets; fix mismatches; smoke test payroll output | P2 | completed |
| **Day 6** | Extract calculation steps into `payroll_calculator.py`; first unit tests | P3 | completed |
| **Day 7** | Expand tests (`pit_calc`, payroll calculator); edge PIT cases | P3 | completed |
| **Day 8** | Role checks for payroll endpoints; hide/disable UI by role | P4 | completed |
| **Day 9** | Run `bootstrap_full_database.sh` on staging DB; fix seed/admin issues; short runbook addendum | P5 | completed |
| **Day 10** | EKS/ECR: image push, Deployment manifests, ConfigMap/Secrets (start) | P6 | completed |
| **Day 11** | EKS: RDS/Elastiache connectivity, Ingress/TLS, smoke test API | P6 | completed |
| **Day 12** | QA pass: payroll month lifecycle; document defects | P7 | completed |
| **Day 13** | Bug fixes from QA; retest | P7 | WIP |
| **Day 14** | Docs: smoke tests v4 roles; cleanup obsolete Superset references | P8 | pending |
| **Day 15** | Buffer: spillover from P1–P8, hardening, demo prep | — | pending |

**Status values:** `pending` (not started), `WIP` (in progress), `completed` (done for that day). When a day is finished, set it to `completed` and move `WIP` to the next day’s row.

**If scope is reduced** (e.g. skip EKS this sprint), drop or slide **Day 10–11** and close P6 later.

---

## 4. How to use this file

1. Set **Day 1** = your project kickoff date in a calendar.
2. Update the **Status** column in section 3 as you go: only one day should usually be **WIP** at a time; set finished days to **completed**, upcoming days **pending**.
3. Mark items **Done** in section 2 as you complete them (or move to section 1).
4. Adjust **Est. (h)** and **Day** rows after each sprint retrospective.
5. Keep **6 h/day** as planning capacity; record actual hours separately if needed.

---

*Generated for IFMS payroll / platform work. Edit freely.*
