-- Apply manually to existing databases where app_login_history was never created
-- (e.g. Postgres volume initialized before db/init/09_app_user.sql included this table).
--
-- Run (from host, adjust password):
--   docker compose exec -T postgres psql -U postgres -d payroll_db < db/patches/001_app_login_history.sql

CREATE TABLE IF NOT EXISTS app_login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
    login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS ix_app_login_history_user_login_at
    ON app_login_history (user_id, login_at);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payroll_app') THEN
        GRANT SELECT, INSERT ON TABLE app_login_history TO payroll_app;
        GRANT USAGE, SELECT ON SEQUENCE app_login_history_id_seq TO payroll_app;
    END IF;
END $$;
