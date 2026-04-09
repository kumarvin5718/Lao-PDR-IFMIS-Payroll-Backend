-- IFMS Payroll — dev admin user (password: password123456)
-- Requires: app_user table (SQLAlchemy create_all) with v4 role CHECK.
-- bcrypt hash below matches plain password: password123456
-- Idempotent: ON CONFLICT (username) DO UPDATE

INSERT INTO app_user (
    username,
    full_name,
    email,
    password_hash,
    role,
    ministry_scope,
    preferred_language,
    registration_status,
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
    'ACTIVE',
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
    registration_status = EXCLUDED.registration_status,
    is_active = EXCLUDED.is_active,
    force_password_change = EXCLUDED.force_password_change;
