-- ============================================================================
-- KRONOS LEDGER — 04_rls_policies_ledger_sales.sql
-- RLS Policies: journal_lines, products, invoices
-- ============================================================================

-- 5.5 journal_lines
CREATE POLICY "journal_lines_select_member"
  ON public.journal_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND public.is_org_member(t.org_id)
    )
  );

CREATE POLICY "journal_lines_insert_by_role"
  ON public.journal_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND (
          public.has_org_role(t.org_id, ARRAY['owner', 'accountant'])
          OR (
            public.has_org_role(t.org_id, ARRAY['staff'])
            AND t.status = 'PENDING'
            AND t.created_by = auth.uid()
          )
        )
    )
  );

CREATE POLICY "journal_lines_update_pending_only"
  ON public.journal_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.status = 'PENDING'
        AND (
          public.has_org_role(t.org_id, ARRAY['owner', 'accountant'])
          OR (public.has_org_role(t.org_id, ARRAY['staff']) AND t.created_by = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.status = 'PENDING'
        AND (
          public.has_org_role(t.org_id, ARRAY['owner', 'accountant'])
          OR (public.has_org_role(t.org_id, ARRAY['staff']) AND t.created_by = auth.uid())
        )
    )
  );

CREATE POLICY "journal_lines_delete_pending_only"
  ON public.journal_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id
        AND t.status = 'PENDING'
        AND (
          public.has_org_role(t.org_id, ARRAY['owner', 'accountant'])
          OR (public.has_org_role(t.org_id, ARRAY['staff']) AND t.created_by = auth.uid())
        )
    )
  );

-- 5.6 products
CREATE POLICY "products_select_member"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "products_insert_owner_accountant"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner', 'accountant']));

CREATE POLICY "products_update_owner_accountant"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner', 'accountant']))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner', 'accountant']));

CREATE POLICY "products_delete_owner_accountant"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner', 'accountant']));

-- 5.7 invoices
CREATE POLICY "invoices_select_member"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "invoices_insert_by_role"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_org_role(org_id, ARRAY['owner', 'accountant'])
      OR (public.has_org_role(org_id, ARRAY['staff']) AND status = 'DRAFT')
    )
  );

CREATE POLICY "invoices_update_owner_accountant"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner', 'accountant']))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner', 'accountant']));

CREATE POLICY "invoices_update_staff_own_draft"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (
    public.has_org_role(org_id, ARRAY['staff'])
    AND status = 'DRAFT'
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.has_org_role(org_id, ARRAY['staff'])
    AND status = 'DRAFT'
    AND created_by = auth.uid()
  );

CREATE POLICY "invoices_delete_owner_accountant"
  ON public.invoices FOR DELETE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner', 'accountant']));
