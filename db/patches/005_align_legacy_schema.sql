-- =============================================================================
-- Align older PostgreSQL volumes with current ORM (production / upgraded deploys).
--
-- SQLAlchemy create_all(checkfirst=True) creates MISSING tables only — it does NOT
-- add new columns to existing tables. After deploying new code against an old DB,
-- run this BEFORE db/init/08_seed_data.sql (bootstrap runs it automatically).
--
-- Fixes errors like:
--   column lk_grade_step.min_prior_experience_years does not exist
--   column lk_location_master.country_key does not exist
--   column lk_allowance_rates.description does not exist
--   column lk_bank_master.category does not exist
--
-- PIT: relaxes income_to_lak NOT NULL and replaces ck_lk_pit_range for open bracket.
-- If lk_location_master still fails (e.g. wrong primary key), back up and see
-- deploy/README.md "Severe schema drift".
-- =============================================================================

-- lk_grade_step
ALTER TABLE lk_grade_step ADD COLUMN IF NOT EXISTS min_prior_experience_years INTEGER;

-- lk_allowance_rates
ALTER TABLE lk_allowance_rates ADD COLUMN IF NOT EXISTS description TEXT;

-- lk_bank_master
ALTER TABLE lk_bank_master ADD COLUMN IF NOT EXISTS category VARCHAR(120);

-- lk_location_master
ALTER TABLE lk_location_master ADD COLUMN IF NOT EXISTS country_key VARCHAR(10);
ALTER TABLE lk_location_master ADD COLUMN IF NOT EXISTS district_key VARCHAR(16);

UPDATE lk_location_master
SET country_key = 'LA'
WHERE country_key IS NULL AND (country = 'Lao PDR' OR country ILIKE '%lao%');

UPDATE lk_location_master
SET country_key = 'INT'
WHERE country_key IS NULL;

UPDATE lk_location_master
SET district_key = substr(md5(COALESCE(province_key, '') || '|' || COALESCE(district, '') || '|' || ctid::text), 1, 16)
WHERE district_key IS NULL;

-- Enforce NOT NULL when every row is populated (may skip on empty table — OK)
ALTER TABLE lk_location_master ALTER COLUMN country_key SET NOT NULL;
ALTER TABLE lk_location_master ALTER COLUMN district_key SET NOT NULL;

-- PIT open-ended upper bound (MoF 2026)
ALTER TABLE lk_pit_brackets ALTER COLUMN income_to_lak DROP NOT NULL;

ALTER TABLE lk_pit_brackets DROP CONSTRAINT IF EXISTS ck_lk_pit_range;

ALTER TABLE lk_pit_brackets ADD CONSTRAINT ck_lk_pit_range
  CHECK (income_to_lak IS NULL OR income_to_lak > income_from_lak);
