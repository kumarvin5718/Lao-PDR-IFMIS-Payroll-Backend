-- payroll_all: current + archived payroll with employee ministry context (Superset).
-- Apply after ORM tables exist:
--   docker compose exec api python scripts/create_dev_tables.py
--   docker compose exec -T postgres psql -U postgres -d payroll_db < db/patches/002_payroll_all_view.sql

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
