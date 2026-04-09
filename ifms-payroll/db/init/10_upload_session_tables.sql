-- IFMS Payroll — upload_session + upload_session_row (employee bulk upload)

CREATE TABLE IF NOT EXISTS upload_session (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_type VARCHAR(30) NOT NULL,
    uploaded_by VARCHAR(80) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    file_path VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_rows INTEGER,
    valid_rows INTEGER,
    warning_rows INTEGER,
    error_rows INTEGER,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_session_row (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES upload_session (session_id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    employee_code VARCHAR(10),
    raw_data TEXT NOT NULL,
    status VARCHAR(10) NOT NULL,
    errors TEXT,
    warnings TEXT
);

CREATE INDEX IF NOT EXISTS ix_upload_session_row_session_id ON upload_session_row (session_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'payroll_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE upload_session TO payroll_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE upload_session_row TO payroll_app;
        GRANT USAGE, SELECT ON SEQUENCE upload_session_row_id_seq TO payroll_app;
    END IF;
END $$;
