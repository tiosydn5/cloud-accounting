-- ============================================================================
-- KRONOS LEDGER — 10_rpc_post_journal_entry.sql
-- Atomic Double-Entry RPCs: post_double_entry_transaction & create_journal_entry
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4. ATOMIC RPC: post_double_entry_transaction(...) & WORKFLOW HELPERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.post_double_entry_transaction(
  p_org_id UUID,
  p_tx_date DATE,
  p_reference_no TEXT,
  p_description TEXT,
  p_lines JSONB,
  p_status TEXT DEFAULT 'POSTED'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_id UUID;
  v_line_count INTEGER;
  v_total_debit NUMERIC(15,2);
  v_total_credit NUMERIC(15,2);
  v_invalid_account_count INTEGER;
  v_invalid_line_count INTEGER;
  v_status TEXT;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id) THEN
    RAISE EXCEPTION 'Organization % not found', p_org_id;
  END IF;

  IF p_description IS NULL OR char_length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'Transaction description cannot be empty';
  END IF;

  v_status := UPPER(COALESCE(NULLIF(trim(p_status), ''), 'POSTED'));
  IF v_status NOT IN ('PENDING', 'POSTED') THEN
    RAISE EXCEPTION 'Invalid initial transaction status: %. Allowed: PENDING, POSTED', v_status;
  END IF;

  -- Enforce RBAC unless invoked internally by trusted DB automation
  IF auth.uid() IS NOT NULL
     AND COALESCE(current_setting('kronos.internal_tx_call', true), 'false') <> 'true' THEN
    IF v_status = 'POSTED' AND NOT public.has_org_role(p_org_id, ARRAY['owner', 'accountant']) THEN
      RAISE EXCEPTION 'Only owner or accountant can post transactions directly. Staff must submit PENDING transactions.'
        USING ERRCODE = '42501';
    ELSIF v_status = 'PENDING' AND NOT public.is_org_member(p_org_id) THEN
      RAISE EXCEPTION 'User is not a member of organization %', p_org_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'p_lines must be a JSON array of journal lines';
  END IF;

  v_line_count := jsonb_array_length(p_lines);
  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'Double-entry transaction requires at least 2 journal lines (got %)', v_line_count
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validate individual lines (positive single-sided amounts)
  SELECT COUNT(*)
  INTO v_invalid_line_count
  FROM jsonb_to_recordset(p_lines) AS l(account_id UUID, debit NUMERIC, credit NUMERIC)
  WHERE l.account_id IS NULL
     OR COALESCE(l.debit, 0) < 0
     OR COALESCE(l.credit, 0) < 0
     OR (ROUND(COALESCE(l.debit, 0), 2) = 0 AND ROUND(COALESCE(l.credit, 0), 2) = 0)
     OR (ROUND(COALESCE(l.debit, 0), 2) > 0 AND ROUND(COALESCE(l.credit, 0), 2) > 0);

  IF v_invalid_line_count > 0 THEN
    RAISE EXCEPTION 'Each journal line must have a valid account_id and either a positive debit or a positive credit (never both or zero).'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Validate all accounts exist and belong to p_org_id
  SELECT COUNT(*)
  INTO v_invalid_account_count
  FROM jsonb_to_recordset(p_lines) AS l(account_id UUID, debit NUMERIC, credit NUMERIC)
  LEFT JOIN public.accounts a
    ON a.id = l.account_id
   AND a.org_id = p_org_id
  WHERE a.id IS NULL;

  IF v_invalid_account_count > 0 THEN
    RAISE EXCEPTION 'One or more accounts do not exist or do not belong to organization %', p_org_id;
  END IF;

  -- Validate Total Debit == Total Credit
  SELECT
    COALESCE(SUM(ROUND(COALESCE(l.debit, 0), 2)), 0),
    COALESCE(SUM(ROUND(COALESCE(l.credit, 0), 2)), 0)
  INTO v_total_debit, v_total_credit
  FROM jsonb_to_recordset(p_lines) AS l(account_id UUID, debit NUMERIC, credit NUMERIC);

  IF v_total_debit <= 0 OR v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Unbalanced double-entry transaction: Total Debit (%) != Total Credit (%)',
      v_total_debit, v_total_credit
      USING ERRCODE = 'check_violation';
  END IF;

  -- Insert header atomically
  INSERT INTO public.transactions (
    org_id,
    tx_date,
    reference_no,
    description,
    status,
    created_by
  )
  VALUES (
    p_org_id,
    COALESCE(p_tx_date, CURRENT_DATE),
    NULLIF(trim(p_reference_no), ''),
    trim(p_description),
    v_status,
    auth.uid()
  )
  RETURNING id INTO v_tx_id;

  -- Insert all journal lines atomically (triggers update accounts.balance if POSTED)
  INSERT INTO public.journal_lines (transaction_id, account_id, debit, credit)
  SELECT
    v_tx_id,
    l.account_id,
    ROUND(COALESCE(l.debit, 0), 2),
    ROUND(COALESCE(l.credit, 0), 2)
  FROM jsonb_to_recordset(p_lines) AS l(account_id UUID, debit NUMERIC, credit NUMERIC);

  RETURN v_tx_id;
END;
$$;

-- Compatibility wrapper matching PRD naming create_journal_entry
CREATE OR REPLACE FUNCTION public.create_journal_entry(
  p_org_id UUID,
  p_tx_date DATE,
  p_reference_no TEXT,
  p_description TEXT,
  p_lines JSONB,
  p_status TEXT DEFAULT 'POSTED'
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.post_double_entry_transaction(
    p_org_id,
    p_tx_date,
    p_reference_no,
    p_description,
    p_lines,
    p_status
  );
$$;
