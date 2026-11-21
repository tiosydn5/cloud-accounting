-- ============================================================================
-- KRONOS LEDGER — 12_audit_trail.sql
-- Automatic Audit Trail Function & Triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5. AUTOMATIC AUDIT TRAIL TRIGGER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_record_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_org_id := NEW.org_id;
    v_record_id := NEW.id;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_org_id := NEW.org_id;
    v_record_id := NEW.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_org_id := OLD.org_id;
    v_record_id := OLD.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  END IF;

  -- Skip inserting audit logs if parent organization was deleted via ON DELETE CASCADE
  IF v_org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v_org_id) THEN
    INSERT INTO public.audit_logs (
      org_id,
      user_id,
      table_name,
      record_id,
      action,
      old_data,
      new_data
    )
    VALUES (
      v_org_id,
      auth.uid(),
      TG_TABLE_NAME,
      v_record_id,
      TG_OP,
      v_old_data,
      v_new_data
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
CREATE TRIGGER trg_audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS trg_audit_accounts ON public.accounts;
CREATE TRIGGER trg_audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();

DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_trail();
