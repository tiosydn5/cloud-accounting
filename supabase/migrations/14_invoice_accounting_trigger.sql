-- ============================================================================
-- KRONOS LEDGER — 14_invoice_accounting_trigger.sql
-- Invoice Accrual/Settlement Auto-Accounting Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_invoice_accounting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ar_acc_id UUID;
  v_rev_acc_id UUID;
  v_pay_acc_id UUID;
  v_lines JSONB := '[]'::JSONB;
  v_has_ar_posted BOOLEAN := false;
  v_has_pay_posted BOOLEAN := false;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Lookup standard accounts for the organization
  SELECT id INTO v_ar_acc_id FROM public.accounts WHERE org_id = NEW.org_id AND code = '1201' LIMIT 1;
  SELECT id INTO v_rev_acc_id FROM public.accounts WHERE org_id = NEW.org_id AND code = '4101' LIMIT 1;
  IF v_rev_acc_id IS NULL THEN
    SELECT id INTO v_rev_acc_id FROM public.accounts WHERE org_id = NEW.org_id AND category = 'REVENUE' ORDER BY code LIMIT 1;
  END IF;

  -- Case A: Accrual AR recognition on DRAFT -> SENT / OVERDUE
  IF OLD.status = 'DRAFT' AND NEW.status IN ('SENT', 'OVERDUE') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.transactions
      WHERE org_id = NEW.org_id
        AND reference_no = NEW.invoice_number || '-AR'
        AND status = 'POSTED'
    ) INTO v_has_ar_posted;

    IF NOT v_has_ar_posted THEN
      IF NEW.total_amount > 0 AND v_ar_acc_id IS NOT NULL AND v_rev_acc_id IS NOT NULL THEN
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_ar_acc_id,  'debit', NEW.total_amount, 'credit', 0),
          jsonb_build_object('account_id', v_rev_acc_id, 'debit', 0,                'credit', NEW.total_amount)
        );
      END IF;

      v_lines := v_lines || public.deduct_invoice_stock_and_build_cogs_lines(NEW.id, NEW.org_id);

      IF jsonb_array_length(v_lines) >= 2 THEN
        PERFORM set_config('kronos.internal_tx_call', 'true', true);
        PERFORM public.post_double_entry_transaction(
          NEW.org_id,
          CURRENT_DATE,
          NEW.invoice_number || '-AR',
          'Pengakuan Piutang Invoice ' || NEW.invoice_number || ' (' || NEW.client_name || ')',
          v_lines,
          'POSTED'
        );
        PERFORM set_config('kronos.internal_tx_call', 'false', true);
      END IF;
    END IF;

  -- Case B: Settlement / Payment on * -> PAID
  ELSIF OLD.status <> 'PAID' AND NEW.status = 'PAID' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.transactions
      WHERE org_id = NEW.org_id
        AND reference_no = NEW.invoice_number || '-PAY'
        AND status = 'POSTED'
    ) INTO v_has_pay_posted;

    IF NOT v_has_pay_posted THEN
      v_pay_acc_id := NULLIF(current_setting('kronos.payment_account_id', true), '')::UUID;
      IF v_pay_acc_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.accounts WHERE id = v_pay_acc_id AND org_id = NEW.org_id
        ) THEN
          RAISE EXCEPTION 'Invalid payment account % for organization %', v_pay_acc_id, NEW.org_id;
        END IF;
      ELSE
        SELECT id INTO v_pay_acc_id FROM public.accounts WHERE org_id = NEW.org_id AND code = '1102' LIMIT 1;
        IF v_pay_acc_id IS NULL THEN
          SELECT id INTO v_pay_acc_id FROM public.accounts WHERE org_id = NEW.org_id AND code = '1101' LIMIT 1;
        END IF;
        IF v_pay_acc_id IS NULL THEN
          SELECT id INTO v_pay_acc_id FROM public.accounts
          WHERE org_id = NEW.org_id AND category = 'ASSET' AND code LIKE '11%'
          ORDER BY code LIMIT 1;
        END IF;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.transactions
        WHERE org_id = NEW.org_id
          AND reference_no = NEW.invoice_number || '-AR'
          AND status = 'POSTED'
      ) INTO v_has_ar_posted;

      IF v_has_ar_posted THEN
        -- Settle existing Accounts Receivable
        IF NEW.total_amount > 0 AND v_pay_acc_id IS NOT NULL AND v_ar_acc_id IS NOT NULL THEN
          v_lines := jsonb_build_array(
            jsonb_build_object('account_id', v_pay_acc_id, 'debit', NEW.total_amount, 'credit', 0),
            jsonb_build_object('account_id', v_ar_acc_id,  'debit', 0,                'credit', NEW.total_amount)
          );
        END IF;
      ELSE
        -- Direct cash/bank sale (recognize revenue + deduct stock & COGS)
        IF NEW.total_amount > 0 AND v_pay_acc_id IS NOT NULL AND v_rev_acc_id IS NOT NULL THEN
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_pay_acc_id, 'debit', NEW.total_amount, 'credit', 0),
            jsonb_build_object('account_id', v_rev_acc_id, 'debit', 0,                'credit', NEW.total_amount)
          );
        END IF;

        v_lines := v_lines || public.deduct_invoice_stock_and_build_cogs_lines(NEW.id, NEW.org_id);
      END IF;

      IF jsonb_array_length(v_lines) >= 2 THEN
        PERFORM set_config('kronos.internal_tx_call', 'true', true);
        PERFORM public.post_double_entry_transaction(
          NEW.org_id,
          CURRENT_DATE,
          NEW.invoice_number || '-PAY',
          'Pelunasan Invoice ' || NEW.invoice_number || ' (' || NEW.client_name || ')',
          v_lines,
          'POSTED'
        );
        PERFORM set_config('kronos.internal_tx_call', 'false', true);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_accounting ON public.invoices;
CREATE TRIGGER trg_invoices_accounting
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_accounting();
