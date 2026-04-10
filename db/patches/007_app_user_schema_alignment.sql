-- =============================================================================
-- Align app_user with current ORM before loading a pg_dump from another host.
--
-- Old docker-entrypoint init (09_app_user.sql) created app_user without
-- registration_status and with a different role CHECK. Desktop DBs created via
-- create_dev_tables.py have the full column set. Loading a data-only dump then
-- fails with type errors (e.g. boolean vs integer on force_password_change) when
-- target table columns differ.
--
-- Run as superuser ONCE on the target DB before: load_payroll_data.sh
-- The Postgres container does NOT mount the repo — do not use psql -f db/...
-- Pipe from the host (from ifms-payroll/):
--   docker compose exec -T postgres psql -U postgres -d payroll_db -v ON_ERROR_STOP=1 \
--     < db/patches/007_app_user_schema_alignment.sql
-- =============================================================================

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;

-- Legacy mistake: boolean columns stored as int (0/1) breaks pg_dump reload
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_user'
      AND column_name = 'is_active' AND data_type IN ('smallint', 'integer', 'bigint')
  ) THEN
    ALTER TABLE app_user ALTER COLUMN is_active DROP DEFAULT;
    ALTER TABLE app_user ALTER COLUMN is_active TYPE boolean USING (is_active <> 0);
    ALTER TABLE app_user ALTER COLUMN is_active SET DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_user'
      AND column_name = 'force_password_change' AND data_type IN ('smallint', 'integer', 'bigint')
  ) THEN
    ALTER TABLE app_user ALTER COLUMN force_password_change DROP DEFAULT;
    ALTER TABLE app_user ALTER COLUMN force_password_change TYPE boolean USING (force_password_change <> 0);
    ALTER TABLE app_user ALTER COLUMN force_password_change SET DEFAULT false;
  END IF;
END $$;
