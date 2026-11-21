-- ============================================================================
-- KRONOS LEDGER — 13_invoice_helpers_and_cogs.sql
-- Invoice Number Generator & Stock/COGS Calculation Helper
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6. INVOICE AUTOMATION, AUTO-COGS & PUBLIC INVOICE VIEW RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prefix TEXT;
  v_seq INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Access denied for organization %', p_org_id USING ERRCODE = '42501';
  END IF;

  v_prefix := 'INV/' || to_char(CURRENT_DATE, 'YYYYMM') || '/';

  SELECT COALESCE(
    MAX(substring(invoice_number FROM char_length(v_prefix) + 1)::INTEGER),
    0
  ) + 1
  INTO v_seq
  FROM public.invoices
  WHERE org_id = p_org_id
    AND invoice_number LIKE v_prefix || '%'
    AND substring(invoice_number FROM char_length(v_prefix) + 1) ~ '^[0-9]{1,9}$';

  RETURN v_prefix || lpad(v_seq::TEXT, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_invoice_stock_and_build_cogs_lines(
  p_invoice_id UUID,
  p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cogs_acc_id UUID;
  v_inv_acc_id UUID;
  v_item RECORD;
  v_total_cogs NUMERIC(15,2) := 0.00;
BEGIN
  FOR v_item IN
    SELECT ii.product_id, ii.qty, p.cost_price
    FROM public.invoice_items ii
    JOIN public.products p ON p.id = ii.product_id
    WHERE ii.invoice_id = p_invoice_id
      AND ii.product_id IS NOT NULL
  LOOP
    UPDATE public.products
    SET stock_qty = stock_qty - v_item.qty
    WHERE id = v_item.product_id;

    v_total_cogs := v_total_cogs + ROUND(COALESCE(v_item.cost_price, 0) * v_item.qty, 2);
  END LOOP;

  IF v_total_cogs <= 0 THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT id INTO v_cogs_acc_id FROM public.accounts WHERE org_id = p_org_id AND code = '5101' LIMIT 1;
  SELECT id INTO v_inv_acc_id  FROM public.accounts WHERE org_id = p_org_id AND code = '1301' LIMIT 1;

  IF v_cogs_acc_id IS NULL OR v_inv_acc_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  RETURN jsonb_build_array(
    jsonb_build_object('account_id', v_cogs_acc_id, 'debit', v_total_cogs, 'credit', 0),
    jsonb_build_object('account_id', v_inv_acc_id,  'debit', 0,            'credit', v_total_cogs)
  );
END;
$$;
