-- If login with admin / password123456 fails, the app_user row may predate the
-- current seed hash. Run this against payroll_db (as postgres or payroll_app with UPDATE).
-- bcrypt for password: password123456
UPDATE app_user
SET
    password_hash = '$2b$12$SdxOopIpxGdloQwv7.cMWe4OYShQ40AoLda1tIKm9KP0hFvCXGZVa',
    failed_login_count = 0,
    locked_until = NULL
WHERE username = 'admin'
  AND email = 'admin@localhost.dev';
