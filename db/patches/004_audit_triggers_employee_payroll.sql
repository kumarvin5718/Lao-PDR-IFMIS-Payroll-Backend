-- ============================================================
-- Patch 004 — Field-level audit for employee + payroll_monthly (SRS §12)
-- Idempotent: safe to run on DBs that already have LK triggers from 07_triggers.sql.
--
-- Prerequisites: tables `employee` and `payroll_monthly` exist (SQLAlchemy create_all).
-- Apply after create_all / bootstrap, same as db/init/07_triggers.sql tail section.
-- ============================================================

SET client_min_messages TO WARNING;

CREATE OR REPLACE FUNCTION fn_audit_log_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    col_name   TEXT;
    old_val    TEXT;
    row_key    TEXT;
    changed_by TEXT;
BEGIN
    IF TG_NARGS >= 2 THEN
        EXECUTE format(
            'SELECT ($1).%I::TEXT || ''|'' || ($1).%I::TEXT',
            TG_ARGV[0], TG_ARGV[1]
        ) INTO row_key USING OLD;
    ELSIF TG_NARGS = 1 THEN
        EXECUTE format('SELECT ($1).%I::TEXT', TG_ARGV[0]) INTO row_key USING OLD;
    ELSE
        row_key := TG_TABLE_NAME || ':row';
    END IF;

    changed_by := COALESCE(
        NULLIF(BTRIM(current_setting('app.audit_user', true)), ''),
        'system'
    );

    FOR col_name IN
        SELECT c.column_name
        FROM information_schema.columns AS c
        WHERE c.table_schema = 'public'
          AND c.table_name = TG_TABLE_NAME
        ORDER BY c.ordinal_position
    LOOP
        EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO old_val USING OLD;
        INSERT INTO audit_log (
            table_name,
            row_key,
            field_name,
            old_value,
            new_value,
            changed_by,
            circular_ref,
            change_remarks
        ) VALUES (
            TG_TABLE_NAME,
            row_key,
            col_name,
            old_val,
            NULL,
            changed_by,
            NULLIF(current_setting('app.circular_ref', true), ''),
            NULLIF(current_setting('app.change_remarks', true), '')
        );
    END LOOP;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_employee_iu ON employee;
CREATE TRIGGER trg_audit_employee_iu
    AFTER INSERT OR UPDATE ON employee
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('employee_code');

DROP TRIGGER IF EXISTS trg_audit_employee_del ON employee;
CREATE TRIGGER trg_audit_employee_del
    AFTER DELETE ON employee
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log_delete('employee_code');

DROP TRIGGER IF EXISTS trg_audit_payroll_monthly_iu ON payroll_monthly;
CREATE TRIGGER trg_audit_payroll_monthly_iu
    AFTER INSERT OR UPDATE ON payroll_monthly
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('employee_code', 'payroll_month');

DROP TRIGGER IF EXISTS trg_audit_payroll_monthly_del ON payroll_monthly;
CREATE TRIGGER trg_audit_payroll_monthly_del
    AFTER DELETE ON payroll_monthly
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log_delete('employee_code', 'payroll_month');
