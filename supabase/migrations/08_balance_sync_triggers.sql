-- ============================================================================
-- KRONOS LEDGER — 08_balance_sync_triggers.sql
-- Automatic Account Balance Synchronization Triggers
-- ============================================================================

-- Trigger on journal_lines to sync accounts.balance when parent tx is POSTED
CREATE OR REPLACE FUNCTION public.sync_balance_on_journal_line_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_new_status FROM public.transactions WHERE id = NEW.transaction_id;
    IF v_new_status = 'POSTED' THEN
      PERFORM public.apply_account_balance_delta(NEW.account_id, NEW.debit, NEW.credit, 1);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT status INTO v_old_status FROM public.transactions WHERE id = OLD.transaction_id;
    SELECT status INTO v_new_status FROM public.transactions WHERE id = NEW.transaction_id;

    IF v_old_status = 'POSTED' THEN
      PERFORM public.apply_account_balance_delta(OLD.account_id, OLD.debit, OLD.credit, -1);
    END IF;
    IF v_new_status = 'POSTED' THEN
      PERFORM public.apply_account_balance_delta(NEW.account_id, NEW.debit, NEW.credit, 1);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Only reverse here if parent transaction still exists (single-line deletion).
    -- Full transaction deletions are reversed in trg_transactions_before_delete.
    SELECT status INTO v_old_status FROM public.transactions WHERE id = OLD.transaction_id;
    IF FOUND AND v_old_status = 'POSTED' THEN
      PERFORM public.apply_account_balance_delta(OLD.account_id, OLD.debit, OLD.credit, -1);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_lines_sync_balance ON public.journal_lines;
CREATE TRIGGER trg_journal_lines_sync_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_balance_on_journal_line_change();

-- Reverse balances BEFORE deleting a POSTED transaction (before cascade deletes lines)
CREATE OR REPLACE FUNCTION public.sync_balance_on_tx_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line RECORD;
BEGIN
  IF OLD.status = 'POSTED' THEN
    FOR v_line IN
      SELECT account_id, debit, credit
      FROM public.journal_lines
      WHERE transaction_id = OLD.id
    LOOP
      PERFORM public.apply_account_balance_delta(v_line.account_id, v_line.debit, v_line.credit, -1);
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_before_delete ON public.transactions;
CREATE TRIGGER trg_transactions_before_delete
  BEFORE DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_balance_on_tx_before_delete();

-- Sync balances when transaction status changes (e.g., PENDING -> POSTED or POSTED -> VOID)
CREATE OR REPLACE FUNCTION public.sync_balance_on_tx_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line RECORD;
  v_line_count INTEGER;
  v_total_debit NUMERIC(15,2);
  v_total_credit NUMERIC(15,2);
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Cannot move a transaction to a different organization.';
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'POSTED' AND NEW.status = 'POSTED' THEN
    SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_line_count, v_total_debit, v_total_credit
    FROM public.journal_lines
    WHERE transaction_id = NEW.id;

    IF v_line_count < 2 OR v_total_debit <= 0 OR v_total_debit <> v_total_credit THEN
      RAISE EXCEPTION 'Cannot post unbalanced or incomplete transaction (%): lines=%, debit=%, credit=%',
        NEW.id, v_line_count, v_total_debit, v_total_credit
        USING ERRCODE = 'check_violation';
    END IF;

    FOR v_line IN
      SELECT account_id, debit, credit
      FROM public.journal_lines
      WHERE transaction_id = NEW.id
    LOOP
      PERFORM public.apply_account_balance_delta(v_line.account_id, v_line.debit, v_line.credit, 1);
    END LOOP;

  ELSIF OLD.status = 'POSTED' AND NEW.status <> 'POSTED' THEN
    FOR v_line IN
      SELECT account_id, debit, credit
      FROM public.journal_lines
      WHERE transaction_id = NEW.id
    LOOP
      PERFORM public.apply_account_balance_delta(v_line.account_id, v_line.debit, v_line.credit, -1);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_status_sync_balance ON public.transactions;
CREATE TRIGGER trg_transactions_status_sync_balance
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_balance_on_tx_status_change();
