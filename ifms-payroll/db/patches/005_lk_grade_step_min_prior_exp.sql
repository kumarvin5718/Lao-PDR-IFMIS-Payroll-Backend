-- LK_GradeStep (LaoPayrollToolkit): minimum prior experience (years) per row.
ALTER TABLE lk_grade_step
    ADD COLUMN IF NOT EXISTS min_prior_experience_years integer NULL;

COMMENT ON COLUMN lk_grade_step.min_prior_experience_years IS
    'Minimum prior experience (years) — LK_GradeStep / MoF toolkit';
