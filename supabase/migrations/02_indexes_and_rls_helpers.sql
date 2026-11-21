-- ============================================================================
-- KRONOS LEDGER — 02_indexes_and_rls_helpers.sql
-- Performance Indexes, RLS Helper Functions & Enable RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2. INDEXES (org_id, tx_date, account_id & Foreign Key Lookups)
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON public.accounts(org_id);

CREATE INDEX IF NOT EXISTS idx_transactions_org_id ON public.transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_date ON public.transactions(tx_date);
CREATE INDEX IF NOT EXISTS idx_transactions_org_tx_date ON public.transactions(org_id, tx_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_org_ref ON public.transactions(org_id, reference_no) WHERE reference_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journal_lines_transaction_id ON public.journal_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON public.journal_lines(account_id);

CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(org_id);

CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(org_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items(product_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);

-- ----------------------------------------------------------------------------
-- 3. RLS HELPER FUNCTIONS (SECURITY DEFINER to avoid recursive RLS lookup)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = target_org_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(target_org_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = target_org_id
      AND m.user_id = auth.uid()
      AND m.role = ANY(allowed_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_role(target_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.role
  FROM public.organization_members m
  WHERE m.org_id = target_org_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_org_role(UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_org_role(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_role(UUID) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

