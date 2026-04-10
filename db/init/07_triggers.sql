-- ============================================================
-- IFMS Payroll — audit triggers (Section 15.6 / SRS §12)
-- Fires on INSERT/UPDATE to the seven lookup tables, plus employee + payroll_monthly.
-- Session vars (set_config / SET LOCAL) expected from the API before writes:
--   app.audit_user, app.circular_ref, app.change_remarks
-- (Do not use app.current_user — "current_user" is reserved in PostgreSQL.)
--
-- Requires: audit_log + lk_* + employee + payroll_monthly (SQLAlchemy create_all)
-- before this runs. If docker-entrypoint runs this before create_all, apply after
-- scripts/create_dev_tables.py (see scripts/bootstrap_full_database.sh order).
-- ============================================================

-- First run: DROP TRIGGER IF EXISTS emits NOTICE "does not exist, skipping" for each
-- lookup — harmless. Suppress NOTICE so deploy logs stay readable (errors still print).
SET client_min_messages TO WARNING;

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    col_name   TEXT;
    old_val    TEXT;
    new_val    TEXT;
    row_key    TEXT;
    changed_by TEXT;
BEGIN
    -- row_key from PK column(s); pass one or two TG_ARGV names (composite PK).
    IF TG_NARGS >= 2 THEN
        EXECUTE format(
            'SELECT ($1).%I::TEXT || ''|'' || ($1).%I::TEXT',
            TG_ARGV[0], TG_ARGV[1]
        ) INTO row_key USING NEW;
    ELSIF TG_NARGS = 1 THEN
        EXECUTE format('SELECT ($1).%I::TEXT', TG_ARGV[0]) INTO row_key USING NEW;
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
        IF TG_OP = 'INSERT' THEN
            old_val := NULL;
            EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO new_val USING NEW;
        ELSE
            EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO old_val USING OLD;
            EXECUTE format('SELECT ($1).%I::TEXT', col_name) INTO new_val USING NEW;
        END IF;

        IF old_val IS DISTINCT FROM new_val THEN
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
                new_val,
                changed_by,
                NULLIF(current_setting('app.circular_ref', true), ''),
                NULLIF(current_setting('app.change_remarks', true), '')
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_lk_allowance_rates ON lk_allowance_rates;
CREATE TRIGGER trg_audit_lk_allowance_rates
    AFTER INSERT OR UPDATE ON lk_allowance_rates
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('allowance_name');

DROP TRIGGER IF EXISTS trg_audit_lk_pit_brackets ON lk_pit_brackets;
CREATE TRIGGER trg_audit_lk_pit_brackets
    AFTER INSERT OR UPDATE ON lk_pit_brackets
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('bracket_no');

DROP TRIGGER IF EXISTS trg_audit_lk_grade_step ON lk_grade_step;
CREATE TRIGGER trg_audit_lk_grade_step
    AFTER INSERT OR UPDATE ON lk_grade_step
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('grade', 'step');

DROP TRIGGER IF EXISTS trg_audit_lk_grade_derivation ON lk_grade_derivation;
CREATE TRIGGER trg_audit_lk_grade_derivation
    AFTER INSERT OR UPDATE ON lk_grade_derivation
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('education_level', 'exp_min_years');

DROP TRIGGER IF EXISTS trg_audit_lk_org_master ON lk_org_master;
CREATE TRIGGER trg_audit_lk_org_master
    AFTER INSERT OR UPDATE ON lk_org_master
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('department_key');

DROP TRIGGER IF EXISTS trg_audit_lk_location_master ON lk_location_master;
CREATE TRIGGER trg_audit_lk_location_master
    AFTER INSERT OR UPDATE ON lk_location_master
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('district_key');

DROP TRIGGER IF EXISTS trg_audit_lk_bank_master ON lk_bank_master;
CREATE TRIGGER trg_audit_lk_bank_master
    AFTER INSERT OR UPDATE ON lk_bank_master
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('bank_name', 'branch_name');

-- ============================================================
-- Employee + payroll_monthly (field-level audit; DELETE uses fn_audit_log_delete)
-- ============================================================

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
