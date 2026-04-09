-- Backfill LK_GradeStep metadata for existing DBs (matches LaoPayrollToolkit / MoF 4904 screen fields).
UPDATE lk_grade_step SET
  effective_from    = DATE '2026-01-01',
  effective_to      = NULL,
  last_updated      = DATE '2025-12-26',
  last_updated_by   = 'SEED_INIT',
  circular_ref      = 'MoF No. 4904/MOF, 26 Dec 2025',
  notes             = 'Basic salary = Grade/Step Index × Salary Index Rate (LAK per index point). MoF 4904/MOF.',
  change_remarks    = NULL
WHERE TRUE;
