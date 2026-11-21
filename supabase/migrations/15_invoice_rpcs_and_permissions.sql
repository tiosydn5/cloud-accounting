-- ============================================================================
-- KRONOS LEDGER — 15_invoice_rpcs_and_permissions.sql
-- Invoice RPCs (mark_invoice_paid, get_public_invoice) & Execution Permissions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  p_invoice_id UUID,
  p_payment_account_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT org_id INTO v_org_id
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.has_org_role(v_org_id, ARRAY['owner', 'accountant']) THEN
    RAISE EXCEPTION 'Only owner or accountant can mark an invoice as PAID'
      USING ERRCODE = '42501';
  END IF;

  IF p_payment_account_id IS NOT NULL THEN
    PERFORM set_config('kronos.payment_account_id', p_payment_account_id::TEXT, true);
  END IF;

  UPDATE public.invoices
  SET status = 'PAID'
  WHERE id = p_invoice_id;

  PERFORM set_config('kronos.payment_account_id', '', true);

  RETURN p_invoice_id;
END;
$$;

-- Safe public read RPC for invoice-view.html?id=... (never exposes tenant list)
CREATE OR REPLACE FUNCTION public.get_public_invoice(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', i.id,
      'invoice_number', i.invoice_number,
      'client_name', i.client_name,
      'client_contact', i.client_contact,
      'issue_date', i.issue_date,
      'due_date', i.due_date,
      'total_amount', i.total_amount,
      'status', i.status,
      'created_at', i.created_at
    ),
    'organization', jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'currency', o.currency,
      'tax_rate', o.tax_rate
    ),
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ii.id,
            'description', ii.description,
            'qty', ii.qty,
            'unit_price', ii.unit_price,
            'subtotal', ii.subtotal
          )
          ORDER BY ii.id
        )
        FROM public.invoice_items ii
        WHERE ii.invoice_id = i.id
      ),
      '[]'::JSONB
    )
  )
  INTO v_result
  FROM public.invoices i
  JOIN public.organizations o ON o.id = i.org_id
  WHERE i.id = p_invoice_id;

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. FUNCTION EXECUTION PERMISSIONS
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.seed_default_coa(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_double_entry_transaction(UUID, DATE, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_journal_entry(UUID, DATE, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_pending_transaction(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_transaction(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_invoice_number(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_invoice_paid(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_invoice(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_account_balance_delta(UUID, NUMERIC, NUMERIC, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deduct_invoice_stock_and_build_cogs_lines(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.seed_default_coa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_double_entry_transaction(UUID, DATE, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_journal_entry(UUID, DATE, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_pending_transaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_transaction(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(UUID) TO anon, authenticated;
