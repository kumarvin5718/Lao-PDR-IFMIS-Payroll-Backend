-- ============================================================
-- IFMS Payroll — seed lookup tables (Section 15.6)
-- Source: LaoPayrollToolkit_v5.xlsx + MoF 4904/MOF Dec 2025
-- DO NOT edit rates here without updating circular_ref
--
-- lk_* tables are created by SQLAlchemy (scripts/create_dev_tables.py), not by db/init DDL.
-- On first `docker compose up`, Postgres runs this file before the API creates tables; that
-- will fail. After create_all, apply this seed, e.g.:
--   docker compose exec api python scripts/create_dev_tables.py
--   docker compose exec -T postgres psql -U postgres -d payroll_db < db/init/08_seed_data.sql
-- Or remove/rename this file for the initial volume bootstrap, then add it back.
-- ============================================================

-- ── lk_pit_brackets (GDT PIT — 6 brackets) ────────────────────
-- income_from_lak = lower threshold for SRS §8.9: pit = cumulative_tax_lak + rate% × (income − income_from_lak)
-- MoF 4904/MOF Jan 2026; bracket 6 open-ended (income_to_lak NULL).
INSERT INTO lk_pit_brackets
  (bracket_no, income_from_lak, income_to_lak, rate_pct, cumulative_tax_lak, description, effective_from, circular_ref)
VALUES
  (1,        0,   1300000,  0.00,        0, 'Exempt — income up to 1,300,000', '2026-01-01', 'GDT / MoF PIT Rates (current)'),
  (2,  1300001,   5000000,  5.00,        0, '5% on amount over 1,300,000', '2026-01-01', 'GDT / MoF PIT Rates (current)'),
  (3,  5000001,  10000000, 10.00,   185000, '10% on amount over 5,000,000', '2026-01-01', 'GDT / MoF PIT Rates (current)'),
  (4, 10000001,  20000000, 15.00,   685000, '15% on amount over 10,000,000', '2026-01-01', 'GDT / MoF PIT Rates (current)'),
  (5, 20000001,  40000000, 20.00,  2185000, '20% on amount over 20,000,000', '2026-01-01', 'GDT / MoF PIT Rates (current)'),
  (6, 40000001,      NULL, 24.00,  6185000, '24% on amount over 40,000,000', '2026-01-01', 'GDT / MoF PIT Rates (current)')
ON CONFLICT (bracket_no) DO UPDATE SET
  income_from_lak = EXCLUDED.income_from_lak,
  income_to_lak = EXCLUDED.income_to_lak,
  rate_pct = EXCLUDED.rate_pct,
  cumulative_tax_lak = EXCLUDED.cumulative_tax_lak,
  description = EXCLUDED.description,
  effective_from = EXCLUDED.effective_from,
  circular_ref = EXCLUDED.circular_ref;


-- ── lk_allowance_rates (MoF 4904/MOF Dec 2025) ────────────────
-- position_level FK + _get_allowance_rate() keys must match allowance_name exactly.
-- PCT rows: eligibility starts with TYPE:PCT; amount_or_rate is percent of basic (e.g. 20 = 20%).
INSERT INTO lk_allowance_rates (allowance_name, amount_or_rate, eligibility, circular_ref) VALUES
  ('Salary Index Rate (ຄ່າດັດສະນີ — LAK per Index Point)',          10000,  'All',                          '4904/MOF Dec 2025'),
  ('SSO Employee Contribution Rate (%)',                               0.055,  'All permanent/probationary',   'SSO/MLSW Decree'),
  ('SSO Employer Contribution Rate (%)',                               0.060,  'Reference only',               'SSO/MLSW Decree'),
  ('Position Allowance - Minister',                                 4500000,  'Minister rank',                '4904/MOF Dec 2025'),
  ('Position Allowance - Deputy Minister',                          3500000,  'Deputy Minister rank',         '4904/MOF Dec 2025'),
  ('Position Allowance - Director',                                 2500000,  'Director rank',                '4904/MOF Dec 2025'),
  ('Position Allowance - Deputy Director',                          2000000,  'Deputy Director rank',         '4904/MOF Dec 2025'),
  ('Position Allowance - Division Chief',                           1500000,  'Division Chief rank',          '4904/MOF Dec 2025'),
  ('Position Allowance - Section Chief',                            1000000,  'Section Chief rank',           '4904/MOF Dec 2025'),
  ('Position Allowance - General Staff',                                  0,  'All others',                   '4904/MOF Dec 2025'),
  ('Years of Service Rate — 1 to 5 Years (LAK/year)',                50000,  '1–5 yrs service',             '4904/MOF Dec 2025'),
  ('Years of Service Rate — 6 to 15 Years (LAK/year)',               70000,  '6–15 yrs service',            '4904/MOF Dec 2025'),
  ('Years of Service Rate — 16 to 25 Years (LAK/year)',              90000,  '16–25 yrs service',           '4904/MOF Dec 2025'),
  ('Years of Service Rate — 26+ Years (LAK/year)',                  110000,  '26+ yrs service',             '4904/MOF Dec 2025'),
  ('Remote / Difficult Area Allowance Rate — % of Basic Salary',        25,  'TYPE:PCT MoHA 292 / remote',   'MoHA Decree 292/GoL 2021'),
  ('Hardship and Hazardous Jobs Allowance',                        300000,  'Hardship / hazardous posting', 'MoHA Decree 292/GoL 2021'),
  ('Foreign Representative Living Allowance (LAK equivalent)',    5000000,  'Foreign representative living','4904/MOF Dec 2025'),
  ('Spouse Benefit',                                                200000,  'Has spouse',                   '4904/MOF Dec 2025'),
  ('Child Benefit (per child, max 3)',                              150000,  'Per eligible child, max 3',    '4904/MOF Dec 2025'),
  ('Teaching Allowance Rate — % of Basic Salary',                      20,  'TYPE:PCT Teaching profession',   '4904/MOF Dec 2025'),
  ('Medical Personnel Allowance',                                    500000,  'Medical personnel',              '4904/MOF Dec 2025'),
  ('Fuel Benefit — High Ranking Officials (Grade 6)',                     0,  'Grade 6 leadership',           '4904/MOF Dec 2025'),
  ('National Assembly (NA) Member Allowance',                        3000000,  'NA members only',              '4904/MOF Dec 2025'),
  ('Housing Allowance',                                              300000,  'Fuel split 1/2; see Transport','4904/MOF Dec 2025'),
  ('Transport Allowance',                                            300000,  'Fuel split 2/2; sum = fuel',     '4904/MOF Dec 2025'),
  ('Teacher',                                                             0,  'profession_category; YoS TBD',   '4904/MOF Dec 2025'),
  ('Medical',                                                             0,  'profession_category; YoS TBD',   '4904/MOF Dec 2025'),
  ('Finance',                                                             0,  'profession_category; YoS TBD',   '4904/MOF Dec 2025'),
  ('Administration',                                                      0,  'profession_category; YoS TBD',   '4904/MOF Dec 2025'),
  ('Technical',                                                           0,  'profession_category; YoS TBD',   '4904/MOF Dec 2025'),
  ('Legal',                                                               0,  'profession_category; YoS TBD',   '4904/MOF Dec 2025'),
  ('Diplomatic',                                                          0,  'profession_category; YoS TBD',   '4904/MOF Dec 2025'),
  ('General',                                                             0,  'profession_category; YoS TBD',   '4904/MOF Dec 2025')
ON CONFLICT (allowance_name) DO NOTHING;

INSERT INTO lk_allowance_rates (allowance_name, amount_or_rate, eligibility, circular_ref)
VALUES
  ('Remote Area',         25,   'TYPE:PCT — Staff in remote/difficult areas',    'MoHA Gazette / Decree 292/GoL 2021'),
  ('Hazardous Area',    1000000, 'Staff in designated hazardous roles',          'MoF No. 4904/MOF, 26 Dec 2025'),
  ('Foreign Posting',   20240000, 'Staff posted abroad',                           'MoF No. 4904/MOF, 26 Dec 2025'),
  ('Spouse Allowance',   200000, 'Married civil servants',                        'MoF No. 4904/MOF, 26 Dec 2025'),
  ('Child Allowance',    200000, 'Per eligible child, max 3',                    'MoF No. 4904/MOF, 26 Dec 2025'),
  ('Teaching Allowance', 20,   'TYPE:PCT — Teaching profession',               'MoF No. 4904/MOF, 26 Dec 2025'),
  ('Medical Allowance',  500000, 'Medical personnel',                             'MoF No. 4904/MOF, 26 Dec 2025'),
  ('NA Member Allowance', 1000000, 'Elected National Assembly Members',             'MoF No. 4904/MOF, 26 Dec 2025'),
  ('Housing Allowance',   300000, 'Civil servants - housing benefit',   'MoF No. 4904/MOF, 26 Dec 2025'),
  ('Transport Allowance', 300000, 'Civil servants - transport benefit',  'MoF No. 4904/MOF, 26 Dec 2025')
ON CONFLICT (allowance_name) DO UPDATE SET amount_or_rate = EXCLUDED.amount_or_rate;

-- MoF 4904/MOF, 26 Dec 2025 (LaoPayrollToolkit_v5.xlsx)
UPDATE lk_allowance_rates SET amount_or_rate = 900000  WHERE allowance_name = 'Position Allowance - General Staff';
UPDATE lk_allowance_rates SET amount_or_rate = 1900000 WHERE allowance_name = 'Position Allowance - Division Chief';
UPDATE lk_allowance_rates SET amount_or_rate = 2300000 WHERE allowance_name = 'Position Allowance - Deputy Director';
UPDATE lk_allowance_rates SET amount_or_rate = 4000000 WHERE allowance_name = 'Position Allowance - Deputy Minister';
UPDATE lk_allowance_rates SET amount_or_rate = 9000000 WHERE allowance_name = 'Position Allowance - Minister';
UPDATE lk_allowance_rates SET amount_or_rate = 1000000 WHERE allowance_name = 'National Assembly (NA) Member Allowance';
UPDATE lk_allowance_rates SET amount_or_rate = 1000000 WHERE allowance_name = 'Hardship and Hazardous Jobs Allowance';
UPDATE lk_allowance_rates SET amount_or_rate = 10000   WHERE allowance_name = 'Years of Service Rate — 1 to 5 Years (LAK/year)';
UPDATE lk_allowance_rates SET amount_or_rate = 20000   WHERE allowance_name = 'Years of Service Rate — 6 to 15 Years (LAK/year)';
UPDATE lk_allowance_rates SET amount_or_rate = 30000   WHERE allowance_name = 'Years of Service Rate — 16 to 25 Years (LAK/year)';
UPDATE lk_allowance_rates SET amount_or_rate = 40000   WHERE allowance_name = 'Years of Service Rate — 26+ Years (LAK/year)';
UPDATE lk_allowance_rates SET amount_or_rate = 20240000 WHERE allowance_name = 'Foreign Representative Living Allowance (LAK equivalent)';
UPDATE lk_allowance_rates SET amount_or_rate = 0       WHERE allowance_name = 'Fuel Benefit — High Ranking Officials (Grade 6)';
UPDATE lk_allowance_rates SET amount_or_rate = 5.5     WHERE allowance_name = 'SSO Employee Contribution Rate (%)';


-- ── lk_grade_step (6 grades: 1–5 × 15 steps, grade 6 × 7 steps; 82 rows) ─
-- LaoPayrollToolkit_v5.xlsx — MoF No. 4904/MOF, 26 Dec 2025
DELETE FROM lk_grade_derivation;
DELETE FROM lk_grade_step;

INSERT INTO lk_grade_step (grade, step, grade_step_index, salary_index_rate, circular_ref)
VALUES
  (1, 1, 260, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 2, 261, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 3, 262, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 4, 263, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 5, 264, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 6, 265, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 7, 266, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 8, 267, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 9, 268, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 10, 269, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 11, 270, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 12, 271, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 13, 272, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 14, 273, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (1, 15, 274, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 1, 268, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 2, 269, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 3, 270, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 4, 271, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 5, 272, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 6, 273, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 7, 274, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 8, 275, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 9, 276, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 10, 277, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 11, 278, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 12, 279, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 13, 280, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 14, 281, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (2, 15, 282, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 1, 276, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 2, 277, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 3, 278, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 4, 279, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 5, 280, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 6, 281, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 7, 282, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 8, 284, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 9, 286, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 10, 288, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 11, 290, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 12, 292, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 13, 294, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 14, 296, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (3, 15, 298, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 1, 286, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 2, 288, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 3, 290, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 4, 292, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 5, 294, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 6, 296, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 7, 298, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 8, 303, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 9, 308, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 10, 313, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 11, 318, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 12, 323, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 13, 328, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 14, 333, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (4, 15, 338, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 1, 308, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 2, 313, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 3, 318, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 4, 323, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 5, 328, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 6, 333, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 7, 338, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 8, 348, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 9, 358, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 10, 368, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 11, 378, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 12, 388, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 13, 398, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 14, 408, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (5, 15, 418, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (6, 1, 600, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (6, 2, 700, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (6, 3, 800, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (6, 4, 900, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (6, 5, 1000, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (6, 6, 1100, 10000, 'MoF No. 4904/MOF, 26 Dec 2025'),
  (6, 7, 1200, 10000, 'MoF No. 4904/MOF, 26 Dec 2025')
ON CONFLICT (grade, step) DO UPDATE SET
  grade_step_index  = EXCLUDED.grade_step_index,
  salary_index_rate = EXCLUDED.salary_index_rate,
  circular_ref      = EXCLUDED.circular_ref;

-- LK_GradeStep metadata (LaoPayrollToolkit tab parity: dates, circular ref, notes; education/prior exp use derivation matrix)
UPDATE lk_grade_step SET
  effective_from    = DATE '2026-01-01',
  effective_to      = NULL,
  last_updated      = DATE '2025-12-26',
  last_updated_by   = 'SEED_INIT',
  circular_ref      = 'MoF No. 4904/MOF, 26 Dec 2025',
  notes             = 'Basic salary = Grade/Step Index × Salary Index Rate (LAK per index point). MoF 4904/MOF.',
  change_remarks    = NULL
WHERE TRUE;


-- ── lk_grade_derivation (Education × Experience → Grade/Step) ─
INSERT INTO lk_grade_derivation
  (education_level, exp_min_years, exp_max_years, derived_grade, derived_step, circular_ref)
VALUES
  ('Primary',           0,  4,  1,  1, '4904/MOF Dec 2025'),
  ('Primary',           5, 40,  1,  5, '4904/MOF Dec 2025'),
  ('Lower Secondary',   0,  4,  1,  5, '4904/MOF Dec 2025'),
  ('Lower Secondary',   5, 40,  2,  1, '4904/MOF Dec 2025'),
  ('Upper Secondary',   0,  4,  2,  1, '4904/MOF Dec 2025'),
  ('Upper Secondary',   5,  9,  2,  5, '4904/MOF Dec 2025'),
  ('Upper Secondary',  10, 40,  3,  1, '4904/MOF Dec 2025'),
  ('Bachelor',          0,  4,  4,  1, '4904/MOF Dec 2025'),
  ('Bachelor',          5,  9,  4,  5, '4904/MOF Dec 2025'),
  ('Bachelor',         10, 19,  5,  1, '4904/MOF Dec 2025'),
  ('Bachelor',         20, 40,  6,  1, '4904/MOF Dec 2025'),
  ('Master',            0,  4,  5,  1, '4904/MOF Dec 2025'),
  ('Master',            5,  9,  5,  5, '4904/MOF Dec 2025'),
  ('Master',           10, 40,  6,  5, '4904/MOF Dec 2025'),
  ('Doctorate',         0,  4,  5,  6, '4904/MOF Dec 2025'),
  ('Doctorate',         5, 40,  5,  7, '4904/MOF Dec 2025')
ON CONFLICT (education_level, exp_min_years) DO NOTHING;
