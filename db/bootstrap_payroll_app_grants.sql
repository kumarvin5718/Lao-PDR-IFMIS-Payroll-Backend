-- PostgreSQL 15+ revoked default CREATE on schema public for the PUBLIC role.
-- create_dev_tables.py connects as payroll_app (see docker-compose DATABASE_URL).
-- Without USAGE + CREATE on public, create_all fails with:
--   permission denied for schema public ... CREATE TABLE app_user
-- Idempotent: safe to re-run.
GRANT USAGE, CREATE ON SCHEMA public TO payroll_app;
