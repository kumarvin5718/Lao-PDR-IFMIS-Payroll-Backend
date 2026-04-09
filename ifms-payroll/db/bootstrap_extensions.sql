-- IFMS Payroll — extensions required for search (SRS) and typical deployments.
-- Run before or after app tables; safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
