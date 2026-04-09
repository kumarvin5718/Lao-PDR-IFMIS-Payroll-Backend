# IFMS Payroll — Superset dashboard SQL

All chart queries below read from the **`payroll_all`** view, which unions **current** (`payroll_monthly`) and **historical** (`payroll_monthly_archive`) rows and joins **`employee`** for ministry and org context.

Connect Superset’s PostgreSQL database user to a **read-only** role (e.g. **`superset_reader`**). Grant **`SELECT`** on **`payroll_all`** (and on underlying tables if you expose only the view, grant **`SELECT`** on the view only).

---

## 1. Database role (example)

Run as a superuser or owner once:

```sql
CREATE ROLE superset_reader LOGIN PASSWORD 'use_a_strong_secret';
GRANT CONNECT ON DATABASE payroll_db TO superset_reader;
GRANT USAGE ON SCHEMA public TO superset_reader;
GRANT SELECT ON payroll_all TO superset_reader;
```

Adjust database name and password to match your environment.

---

## 2. View: `payroll_all` (active + archived)

Deploy the view **after** `create_dev_tables.py` (ORM creates base tables). From the `ifms-payroll` directory:

```bash
docker compose exec -T postgres psql -U postgres -d payroll_db < db/patches/002_payroll_all_view.sql
```

Or run the SQL below manually. It matches `db/patches/002_payroll_all_view.sql`.

```sql
CREATE OR REPLACE VIEW payroll_all AS
SELECT
  m.*,
  e.ministry_name,
  e.department_name,
  e.profession_category,
  e.position_title,
  'active'::text AS payroll_source,
  NULL::timestamptz AS archived_at,
  NULL::text AS archive_reason,
  false AS is_archived
FROM payroll_monthly m
JOIN employee e ON e.employee_code = m.employee_code

UNION ALL

SELECT
  a.employee_code,
  a.payroll_month,
  a.grade,
  a.step,
  a.grade_step_key,
  a.grade_step_index,
  a.salary_index_rate,
  a.basic_salary_lak,
  a.position_allowance_lak,
  a.years_service_allowance_lak,
  a.teaching_allowance_lak,
  a.medical_allowance_lak,
  a.na_member_allowance_lak,
  a.hazardous_allowance_lak,
  a.remote_allowance_lak,
  a.foreign_living_allow_lak,
  a.fuel_benefit_lak,
  a.spouse_benefit_lak,
  a.child_benefit_lak,
  a.other_allowance_1_lak,
  a.other_allowance_1_desc,
  a.other_allowance_2_lak,
  a.other_allowance_2_desc,
  a.other_allowance_3_lak,
  a.other_allowance_3_desc,
  a.total_allowances_lak,
  a.gross_earnings_lak,
  a.sso_rate_ref,
  a.sso_employee_contribution,
  a.taxable_income_lak,
  a.applicable_bracket_no,
  a.pit_amount_lak,
  a.addl_deduction_1_lak,
  a.addl_deduction_1_desc,
  a.addl_deduction_2_lak,
  a.addl_deduction_2_desc,
  a.total_deductions_lak,
  a.net_salary_lak,
  a.approval_status,
  a.approved_by,
  a.approved_at,
  a.is_locked,
  a.locked_by,
  a.locked_at,
  a.calculated_at,
  a.calculated_by,
  e.ministry_name,
  e.department_name,
  e.profession_category,
  e.position_title,
  'archived'::text AS payroll_source,
  a.archived_at,
  a.archive_reason,
  true AS is_archived
FROM payroll_monthly_archive a
JOIN employee e ON e.employee_code = a.employee_code;
```

**Columns:** `payroll_source` is `'active'` or `'archived'`. **`is_archived`** is a boolean mirror (`false` = current run table, `true` = archive) for simple `WHERE is_archived = false` filters.

**Example — current calendar month, active rows only (gross + net):**

```sql
SELECT
  SUM(gross_earnings_lak) AS total_gross_lak,
  SUM(net_salary_lak) AS total_net_lak
FROM payroll_all
WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
  AND is_archived = false;
```

`DATE_TRUNC('month', …)` returns a `timestamp`; cast to **`::date`** so it matches **`payroll_month`** (`DATE`). Without **`::date`**, the comparison can behave unexpectedly. Equivalent filter: `payroll_source = 'active'`.

---

## 3. Superset filters (native, per dashboard)

On **each** dashboard:

1. Add a **time range** or **time column** filter on **`payroll_month`** (monthly payroll rows are stored as the **first day of the month** `DATE`).
2. Add a **filter** on **`ministry_name`** (values from `payroll_all.ministry_name`).

In **SQL Lab / virtual datasets**, enable **Jinja templating** if you use the optional `{% ... %}` clauses below. If you rely entirely on **Superset native filters** on a physical or virtual dataset, you can often use a simple `SELECT ... FROM payroll_all` without Jinja and let the UI apply filters.

Optional Jinja patterns (Superset 3.x/4.x):

```sql
WHERE 1 = 1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
```

Filter keys (`payroll_month`, `ministry_name`) must match the **filter column names** you configure on the dashboard.

---

## 4. Eleven dashboards — copy/paste SQL

Use one virtual dataset per chart or one dataset with parameters; below are **chart-level** queries.

### Dashboard 1 — Executive summary (headcount & payroll totals)

**Chart A — KPI: employees paid**

```sql
SELECT COUNT(DISTINCT employee_code) AS employees_paid
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
```

**Chart B — KPI: total net salary (LAK)**

```sql
SELECT COALESCE(SUM(net_salary_lak), 0)::numeric(18,2) AS total_net_lak
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
```

**Chart C — KPI: total gross (LAK)**

```sql
SELECT COALESCE(SUM(gross_earnings_lak), 0)::numeric(18,2) AS total_gross_lak
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
```

**Chart H — Allowance breakdown by type (current month, active rows)**

```sql
SELECT allowance_type, amount_lak AS total_lak
FROM (
    SELECT 'Position Allowance' AS allowance_type,
           COALESCE(SUM(position_allowance_lak), 0) AS amount_lak
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'Years of Service',
           COALESCE(SUM(years_service_allowance_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'Teaching Allowance',
           COALESCE(SUM(teaching_allowance_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'Medical Allowance',
           COALESCE(SUM(medical_allowance_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'NA Member Allowance',
           COALESCE(SUM(na_member_allowance_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'Hazardous Allowance',
           COALESCE(SUM(hazardous_allowance_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'Remote Allowance',
           COALESCE(SUM(remote_allowance_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'Foreign Living Allowance',
           COALESCE(SUM(foreign_living_allow_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'Fuel Benefit',
           COALESCE(SUM(fuel_benefit_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
    UNION ALL
    SELECT 'Spouse + Child Benefits',
           COALESCE(SUM(spouse_benefit_lak + child_benefit_lak), 0)
    FROM payroll_all
    WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND is_archived = false
) t
ORDER BY total_lak DESC;
```

---

### Dashboard 2 — Employee Analytics

All queries source from the **`employee`** table only — no **`payroll_all`** join needed.

**Chart 2a — Pie: Headcount by Employment Type**

```sql
SELECT employment_type, COUNT(*) AS headcount
FROM employee
WHERE is_active = true
GROUP BY employment_type
ORDER BY headcount DESC;
```

**Chart 2b — Bar: Headcount by Ministry**

```sql
SELECT ministry_name, COUNT(*) AS headcount
FROM employee
WHERE is_active = true
GROUP BY ministry_name
ORDER BY headcount DESC;
```

**Chart 2c — Histogram: Grade Distribution**

```sql
SELECT grade, COUNT(*) AS headcount
FROM employee
WHERE is_active = true
GROUP BY grade
ORDER BY grade;
```

**Chart 2d — Stacked Bar: Headcount by Ministry x Gender**

```sql
SELECT ministry_name, gender, COUNT(*) AS headcount
FROM employee
WHERE is_active = true
GROUP BY ministry_name, gender
ORDER BY ministry_name, gender;
```

**Chart 2e — Table: Years of Service Bands**

```sql
SELECT
    band_order,
    service_band,
    COUNT(*) AS headcount
FROM (
    SELECT
        CASE
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining)) BETWEEN 0  AND 5  THEN 1
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining)) BETWEEN 6  AND 10 THEN 2
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining)) BETWEEN 11 AND 20 THEN 3
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining)) BETWEEN 21 AND 30 THEN 4
            ELSE 5
        END AS band_order,
        CASE
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining)) BETWEEN 0  AND 5  THEN '0-5 years'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining)) BETWEEN 6  AND 10 THEN '6-10 years'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining)) BETWEEN 11 AND 20 THEN '11-20 years'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining)) BETWEEN 21 AND 30 THEN '21-30 years'
            ELSE '31+ years'
        END AS service_band
    FROM employee
    WHERE is_active = true
) t
GROUP BY band_order, service_band
ORDER BY band_order;
```

---

### Dashboard 3 — Allowance Distribution

All queries use **`payroll_all`** with **`is_archived = false`** and **`::date`** cast on **`payroll_month`**.

**Chart 3a — Stacked Bar: Allowance Types as % of Gross by Ministry**

```sql
SELECT
    ministry_name,
    ROUND(SUM(position_allowance_lak)      * 100.0 / NULLIF(SUM(gross_earnings_lak), 0), 1) AS position_pct,
    ROUND(SUM(years_service_allowance_lak) * 100.0 / NULLIF(SUM(gross_earnings_lak), 0), 1) AS yos_pct,
    ROUND(SUM(teaching_allowance_lak)      * 100.0 / NULLIF(SUM(gross_earnings_lak), 0), 1) AS teaching_pct,
    ROUND(SUM(medical_allowance_lak)       * 100.0 / NULLIF(SUM(gross_earnings_lak), 0), 1) AS medical_pct,
    ROUND(SUM(remote_allowance_lak)        * 100.0 / NULLIF(SUM(gross_earnings_lak), 0), 1) AS remote_pct,
    ROUND(SUM(hazardous_allowance_lak)     * 100.0 / NULLIF(SUM(gross_earnings_lak), 0), 1) AS hazardous_pct,
    ROUND(SUM(foreign_living_allow_lak)    * 100.0 / NULLIF(SUM(gross_earnings_lak), 0), 1) AS foreign_pct
FROM payroll_all
WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
  AND is_archived = false
GROUP BY ministry_name
ORDER BY ministry_name;
```

Note: **`payroll_all`** already includes **`ministry_name`** from the view — no join to **`employee`** needed.

**Chart 3b — Table: Count of Special Allowance Recipients**

```sql
SELECT allowance_type, recipients
FROM (
    SELECT 'Remote Area'     AS allowance_type, COUNT(*) AS recipients FROM employee WHERE is_active = true AND is_remote_area     = true
    UNION ALL
    SELECT 'Hazardous Area',                    COUNT(*) FROM employee WHERE is_active = true AND is_hazardous_area  = true
    UNION ALL
    SELECT 'Foreign Posting',                   COUNT(*) FROM employee WHERE is_active = true AND is_foreign_posting = true
    UNION ALL
    SELECT 'NA Member',                         COUNT(*) FROM employee WHERE is_active = true AND is_na_member       = true
    UNION ALL
    SELECT 'Teaching',                          COUNT(*) FROM employee WHERE is_active = true AND field_allowance_type = 'Teaching'
    UNION ALL
    SELECT 'Medical',                           COUNT(*) FROM employee WHERE is_active = true AND field_allowance_type = 'Medical'
) t
ORDER BY recipients DESC;
```

**Chart 3c — Treemap: Allowance LAK Totals by Type (current month)**

```sql
SELECT allowance_type, amount_lak
FROM (
    SELECT 'Position'         AS allowance_type, COALESCE(SUM(position_allowance_lak),      0) AS amount_lak FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Years of Service',                   COALESCE(SUM(years_service_allowance_lak),  0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Teaching',                           COALESCE(SUM(teaching_allowance_lak),       0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Medical',                            COALESCE(SUM(medical_allowance_lak),        0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Remote Area',                        COALESCE(SUM(remote_allowance_lak),         0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Hazardous',                          COALESCE(SUM(hazardous_allowance_lak),      0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'NA Member',                          COALESCE(SUM(na_member_allowance_lak),      0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Foreign Living',                     COALESCE(SUM(foreign_living_allow_lak),     0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Fuel Benefit',                       COALESCE(SUM(fuel_benefit_lak),             0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Spouse Benefit',                     COALESCE(SUM(spouse_benefit_lak),           0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
    UNION ALL
    SELECT 'Child Benefit',                      COALESCE(SUM(child_benefit_lak),            0) FROM payroll_all WHERE payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date AND is_archived = false
) t
WHERE amount_lak > 0
ORDER BY amount_lak DESC;
```

---

### Dashboard 4 — Grade & Salary Heatmap

**Chart 4a — Heatmap: Employee Count and Avg Basic Salary by Grade × Step**

```sql
SELECT
    grade,
    step,
    COUNT(*)                        AS employee_count,
    AVG(basic_salary_lak)::BIGINT   AS avg_basic_lak
FROM (
    SELECT
        e.grade,
        e.step,
        p.basic_salary_lak
    FROM payroll_all p
    JOIN employee e ON e.employee_code = p.employee_code
    WHERE p.payroll_month = DATE_TRUNC('month', CURRENT_DATE)::date
      AND p.is_archived = false
      AND e.is_active = true
) t
GROUP BY grade, step
ORDER BY grade, step;
```

Note: In Superset use a Table chart. Set Grade as row, Step as column,
employee_count as the metric. Apply conditional formatting on employee_count
for heatmap colouring. avg_basic_lak is a secondary column for context.

---

### Dashboard 5 — Retirement Forecast

All queries use the `employee` table only. Retirement age is 60 years.

**Chart 5a — Bar: Monthly Retirement Count (next 36 months)**
```sql
SELECT
    DATE_TRUNC('month', date_of_birth + INTERVAL '60 years')::date AS retirement_month,
    COUNT(*) AS retiring_count
FROM employee
WHERE is_active = true
  AND date_of_birth + INTERVAL '60 years'
      BETWEEN DATE_TRUNC('month', CURRENT_DATE)::date
          AND (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '35 months')::date
GROUP BY retirement_month
ORDER BY retirement_month;
```

**Chart 5b — Table: Next 20 Employees Retiring**
```sql
SELECT
    employee_code,
    first_name || ' ' || last_name                        AS full_name,
    ministry_name,
    grade,
    position_title,
    (date_of_birth + INTERVAL '60 years')::date           AS retirement_date,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_joining))::INT AS years_of_service
FROM employee
WHERE is_active = true
  AND date_of_birth + INTERVAL '60 years' >= CURRENT_DATE
ORDER BY retirement_date
LIMIT 20;
```

---

### Dashboard 6 — PIT & SSO Trend

**Chart 6a — Dual-axis Line: PIT and SSO rolling 12 months**
```sql
SELECT
    payroll_month,
    COALESCE(SUM(pit_amount_lak),            0) AS total_pit_lak,
    COALESCE(SUM(sso_employee_contribution), 0) AS total_sso_employee_lak,
    COALESCE(ROUND(SUM(sso_employee_contribution) * (6.0 / 5.5), 0), 0) AS total_sso_employer_ref_lak
FROM payroll_all
WHERE payroll_month >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months')::date
  AND payroll_month <= DATE_TRUNC('month', CURRENT_DATE)::date
  AND is_archived = false
GROUP BY payroll_month
ORDER BY payroll_month;
```

Note: In Superset use a Mixed Chart. Map total_pit_lak to left Y-axis (bar),
total_sso_employee_lak to right Y-axis (line).
total_sso_employer_ref_lak is the employer-side reference (6% gross-up of the
5.5% employee rate) — add as a second line or omit if not needed on this dashboard.

---

### Dashboard 7 — By ministry

**Bar chart — net salary by ministry**

```sql
SELECT
  ministry_name,
  SUM(net_salary_lak)::numeric(18,2) AS net_salary_lak
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
GROUP BY ministry_name
ORDER BY net_salary_lak DESC;
```

---

### Dashboard 8 — PIT & tax brackets

**Bar chart — PIT amount by bracket**

```sql
SELECT
  applicable_bracket_no AS pit_bracket_no,
  SUM(pit_amount_lak)::numeric(18,2) AS pit_amount_lak,
  COUNT(*) AS row_count
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
GROUP BY applicable_bracket_no
ORDER BY applicable_bracket_no;
```

---

### Dashboard 9 — Earnings vs deductions composition

**Stacked or grouped — gross, SSO, PIT, net (aggregated)**

```sql
SELECT
  SUM(gross_earnings_lak)::numeric(18,2) AS gross_lak,
  SUM(sso_employee_contribution)::numeric(18,2) AS sso_employee_lak,
  SUM(pit_amount_lak)::numeric(18,2) AS pit_lak,
  SUM(net_salary_lak)::numeric(18,2) AS net_lak
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
```

*(For a true stacked bar, pivot these four measures in the chart layer or use four separate series / a long-format UNION query.)*

---

### Dashboard 10 — Payroll register (detail table)

**Table — line-level payroll**

```sql
SELECT
  payroll_month,
  payroll_source,
  employee_code,
  ministry_name,
  department_name,
  position_title,
  grade,
  step,
  basic_salary_lak,
  gross_earnings_lak,
  sso_employee_contribution,
  taxable_income_lak,
  applicable_bracket_no,
  pit_amount_lak,
  net_salary_lak,
  approval_status,
  is_locked
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
ORDER BY ministry_name, department_name, employee_code;
```

---

### Dashboard 11 — Source & approval status

**Pie or bar — active vs archived**

```sql
SELECT
  payroll_source,
  COUNT(*) AS rows_cnt,
  SUM(net_salary_lak)::numeric(18,2) AS net_salary_lak
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
GROUP BY payroll_source;
```

**Bar — approval_status**

```sql
SELECT
  approval_status,
  COUNT(*) AS rows_cnt
FROM payroll_all
WHERE 1=1
{% if filter_values('payroll_month') %}
  AND payroll_month = CAST('{{ filter_values('payroll_month')[0] }}' AS DATE)
{% endif %}
{% if filter_values('ministry_name') %}
  AND ministry_name IN {{ filter_values('ministry_name')|where_in }}
{% endif %}
GROUP BY approval_status
ORDER BY approval_status;
```

---

## 5. Notes

- **`payroll_month`**: stored as a **`DATE`** (first day of the month). Align the Superset time filter granularity to **month** for intuitive filtering.
- **`payroll_source`**: **`active`** (current run table) vs **`archived`** (archive table). **`is_archived`**: **`false`** / **`true`** — same distinction; use either `NOT is_archived` or `payroll_source = 'active'` when you want to exclude archived snapshots.
- If Jinja is **disabled**, remove the `{% ... %}` blocks and rely on **dataset filters** only, or replace them with fixed `WHERE` clauses for static reports.
