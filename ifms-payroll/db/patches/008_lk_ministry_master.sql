-- Ministry master table (mirrors alembic 0009_ministry_master.py). Apply after fn_audit_log exists (07_triggers.sql).

CREATE TABLE IF NOT EXISTS lk_ministry_master (
  ministry_key          VARCHAR(20)   PRIMARY KEY,
  ministry_name         TEXT          NOT NULL,
  profession_category   VARCHAR(40)   NULL,
  na_allowance_eligible BOOLEAN       NOT NULL DEFAULT false,
  field_allowance_type  VARCHAR(20)   NULL
                        CHECK (field_allowance_type IN ('Teaching','Medical')
                               OR field_allowance_type IS NULL),
  effective_from        DATE          NULL,
  effective_to          DATE          NULL,
  circular_ref          TEXT          NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_lk_ministry_master_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lk_ministry_master_updated_at ON lk_ministry_master;
CREATE TRIGGER trg_lk_ministry_master_updated_at
    BEFORE UPDATE ON lk_ministry_master
    FOR EACH ROW
    EXECUTE FUNCTION fn_lk_ministry_master_touch_updated_at();

DROP TRIGGER IF EXISTS trg_audit_lk_ministry_master ON lk_ministry_master;
CREATE TRIGGER trg_audit_lk_ministry_master
    AFTER INSERT OR UPDATE ON lk_ministry_master
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_log('ministry_key');
