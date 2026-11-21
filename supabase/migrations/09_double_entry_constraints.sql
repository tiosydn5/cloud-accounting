-- ============================================================================
-- KRONOS LEDGER — 09_double_entry_constraints.sql
-- Deferred Double-Entry Balance Constraint Triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3. DEFERRED DOUBLE-ENTRY BALANCE CONSTRAINT TRIGGERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_balanced_journal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_id UUID;
  v_tx_status TEXT;
  v_line_count INTEGER;
  v_total_debit NUMERIC(15,2);
  v_total_credit NUMERIC(15,2);
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    v_tx_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_tx_id := COALESCE(NEW.transaction_id, OLD.transaction_id);
  END IF;

  SELECT status INTO v_tx_status
  FROM public.transactions
  WHERE id = v_tx_id;

  -- Parent transaction was deleted (e.g., cascade delete)
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_line_count, v_total_debit, v_total_credit
  FROM public.journal_lines
  WHERE transaction_id = v_tx_id;

  IF v_tx_status = 'POSTED' OR v_line_count > 0 THEN
    IF v_line_count < 2 OR v_total_debit <= 0 OR v_total_debit <> v_total_credit THEN
      RAISE EXCEPTION 'Double-entry balance constraint violated for transaction % (status=%): lines=%, Total Debit=%, Total Credit=%',
        v_tx_id, v_tx_status, v_line_count, v_total_debit, v_total_credit
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_balanced_journal_lines ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_enforce_balanced_journal_lines
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_balanced_journal();

DROP TRIGGER IF EXISTS trg_enforce_balanced_transaction ON public.transactions;
CREATE CONSTRAINT TRIGGER trg_enforce_balanced_transaction
  AFTER INSERT OR UPDATE ON public.transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_balanced_journal();
