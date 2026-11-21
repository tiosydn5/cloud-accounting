-- ============================================================================
-- KRONOS LEDGER — 07_account_integrity_and_guards.sql
-- Account Integrity Protection, Balance Delta Helper & Journal Line Guards
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2. ACCOUNT INTEGRITY & AUTOMATIC BALANCE SYNCHRONIZATION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_account_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Cannot move an account to a different organization.';
  END IF;

  IF NEW.balance IS DISTINCT FROM OLD.balance
     AND COALESCE(current_setting('kronos.allow_balance_update', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'Direct manual updates to accounts.balance are prohibited. Post a double-entry transaction instead.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.is_system = true AND (
    NEW.code IS DISTINCT FROM OLD.code
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.normal_balance IS DISTINCT FROM OLD.normal_balance
  ) THEN
    RAISE EXCEPTION 'Cannot change code, category, or normal_balance of system account (%).', OLD.code;
  END IF;

  IF NEW.normal_balance IS DISTINCT FROM OLD.normal_balance
     AND EXISTS (SELECT 1 FROM public.journal_lines jl WHERE jl.account_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot change normal_balance of account (%) after journal entries exist.', OLD.code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_protect_integrity ON public.accounts;
CREATE TRIGGER trg_accounts_protect_integrity
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_account_integrity();

-- Internal helper to adjust an account balance according to its normal_balance
CREATE OR REPLACE FUNCTION public.apply_account_balance_delta(
  p_account_id UUID,
  p_debit NUMERIC,
  p_credit NUMERIC,
  p_multiplier INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('kronos.allow_balance_update', 'true', true);

  UPDATE public.accounts
  SET balance = balance + (
    p_multiplier * CASE
      WHEN normal_balance = 'DEBIT' THEN (COALESCE(p_debit, 0) - COALESCE(p_credit, 0))
      ELSE (COALESCE(p_credit, 0) - COALESCE(p_debit, 0))
    END
  )
  WHERE id = p_account_id;

  PERFORM set_config('kronos.allow_balance_update', 'false', true);
END;
$$;

-- Prevent cross-tenant journal lines & mutating posted/void lines directly
CREATE OR REPLACE FUNCTION public.guard_journal_line_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_org_id UUID;
  v_tx_status TEXT;
  v_acc_org_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT t.status INTO v_tx_status
    FROM public.transactions t
    WHERE t.id = OLD.transaction_id;

    -- If parent transaction still exists and is finalized, block direct line deletion
    IF FOUND AND v_tx_status IN ('POSTED', 'VOID') THEN
      RAISE EXCEPTION 'Cannot delete journal lines of a % transaction. Void the transaction instead.', v_tx_status;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT t.status INTO v_tx_status
    FROM public.transactions t
    WHERE t.id = OLD.transaction_id;

    IF v_tx_status IN ('POSTED', 'VOID') THEN
      RAISE EXCEPTION 'Cannot modify journal lines of a % transaction. Void the transaction instead.', v_tx_status;
    END IF;
  END IF;

  SELECT t.org_id, t.status INTO v_tx_org_id, v_tx_status
  FROM public.transactions t
  WHERE t.id = NEW.transaction_id;

  IF TG_OP = 'INSERT' AND v_tx_status = 'VOID' THEN
    RAISE EXCEPTION 'Cannot add journal lines to a VOID transaction.';
  END IF;

  SELECT a.org_id INTO v_acc_org_id
  FROM public.accounts a
  WHERE a.id = NEW.account_id;

  IF v_tx_org_id IS NULL OR v_acc_org_id IS NULL OR v_tx_org_id <> v_acc_org_id THEN
    RAISE EXCEPTION 'Cross-tenant violation: account (%) does not belong to transaction organization (%)',
      NEW.account_id, v_tx_org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_lines_guard ON public.journal_lines;
CREATE TRIGGER trg_journal_lines_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_journal_line_mutation();
