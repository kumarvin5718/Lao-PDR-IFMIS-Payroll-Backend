-- ============================================================
-- IFMS Payroll — app_user (matches backend/app/models/app_user.py)
-- Dev seed: admin / password123456 (change in production)
-- ============================================================

CREATE TABLE IF NOT EXISTS app_user (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(60) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL,
    ministry_scope VARCHAR(80),
    preferred_language VARCHAR(2) NOT NULL DEFAULT 'en',
    is_active BOOLEAN NOT NULL DEFAULT true,
    force_password_change BOOLEAN NOT NULL DEFAULT false,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login TIMESTAMPTZ,
    CONSTRAINT ck_app_user_role CHECK (
        role IN (
            'ROLE_HR',
            'ROLE_FINANCE',
            'ROLE_ADMIN',
            'ROLE_AUDITOR',
            'ROLE_MINISTRY_HEAD'
        )
    ),
    CONSTRAINT ck_app_user_lang CHECK (preferred_language IN ('en', 'lo'))
);

-- Login audit (Phase 3); mirrors Alembic 0002_add_app_login_history
CREATE TABLE IF NOT EXISTS app_login_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user (user_id) ON DELETE CASCADE,
    login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS ix_app_login_history_user_login_at
    ON app_login_history (user_id, login_at);

-- bcrypt hash for password: password123456
INSERT INTO app_user (
    username,
    full_name,
    email,
    password_hash,
    role,
    ministry_scope,
    preferred_language,
    is_active,
    force_password_change
)
VALUES (
    'admin',
    'Dev Admin',
    'admin@localhost.dev',
    '$2b$12$SdxOopIpxGdloQwv7.cMWe4OYShQ40AoLda1tIKm9KP0hFvCXGZVa',
    'ROLE_ADMIN',
    NULL,
    'en',
    true,
    false
)
ON CONFLICT (username) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    ministry_scope = EXCLUDED.ministry_scope,
    preferred_language = EXCLUDED.preferred_language,
    is_active = EXCLUDED.is_active,
    force_password_change = EXCLUDED.force_password_change;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payroll_app') THEN
        GRANT USAGE ON SCHEMA public TO payroll_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app_user TO payroll_app;
        GRANT SELECT, INSERT ON TABLE app_login_history TO payroll_app;
        GRANT USAGE, SELECT ON SEQUENCE app_login_history_id_seq TO payroll_app;
    END IF;
END $$;
