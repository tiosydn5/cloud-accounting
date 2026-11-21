-- ============================================================================
-- KRONOS LEDGER — 11_rpc_tx_status_workflows.sql
-- Transaction Workflow RPCs: approve_pending_transaction & void_transaction
-- ============================================================================

-- Approve a PENDING transaction (for owner / accountant approving staff entries)
CREATE OR REPLACE FUNCTION public.approve_pending_transaction(p_transaction_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_status TEXT;
BEGIN
  SELECT org_id, status
  INTO v_org_id, v_status
  FROM public.transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.has_org_role(v_org_id, ARRAY['owner', 'accountant']) THEN
    RAISE EXCEPTION 'Only owner or accountant can approve pending transactions'
      USING ERRCODE = '42501';
  END IF;

  IF v_status <> 'PENDING' THEN
    RAISE EXCEPTION 'Only PENDING transactions can be approved (current status: %)', v_status;
  END IF;

  UPDATE public.transactions
  SET status = 'POSTED'
  WHERE id = p_transaction_id;

  RETURN p_transaction_id;
END;
$$;

-- Void a transaction safely (automatically reverses account balances if POSTED)
CREATE OR REPLACE FUNCTION public.void_transaction(p_transaction_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_status TEXT;
BEGIN
  SELECT org_id, status
  INTO v_org_id, v_status
  FROM public.transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.has_org_role(v_org_id, ARRAY['owner', 'accountant']) THEN
    RAISE EXCEPTION 'Only owner or accountant can void transactions'
      USING ERRCODE = '42501';
  END IF;

  IF v_status = 'VOID' THEN
    RAISE EXCEPTION 'Transaction % is already VOID', p_transaction_id;
  END IF;

  UPDATE public.transactions
  SET status = 'VOID'
  WHERE id = p_transaction_id;

  RETURN p_transaction_id;
END;
$$;
