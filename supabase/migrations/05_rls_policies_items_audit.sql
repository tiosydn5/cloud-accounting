-- ============================================================================
-- KRONOS LEDGER — 05_rls_policies_items_audit.sql
-- RLS Policies: invoice_items, audit_logs
-- ============================================================================

-- 5.8 invoice_items
CREATE POLICY "invoice_items_select_member"
  ON public.invoice_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND public.is_org_member(i.org_id)
    )
  );

CREATE POLICY "invoice_items_insert_by_role"
  ON public.invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.has_org_role(i.org_id, ARRAY['owner', 'accountant'])
          OR (
            public.has_org_role(i.org_id, ARRAY['staff'])
            AND i.status = 'DRAFT'
            AND i.created_by = auth.uid()
          )
        )
    )
  );

CREATE POLICY "invoice_items_update_by_role"
  ON public.invoice_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.has_org_role(i.org_id, ARRAY['owner', 'accountant'])
          OR (
            public.has_org_role(i.org_id, ARRAY['staff'])
            AND i.status = 'DRAFT'
            AND i.created_by = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.has_org_role(i.org_id, ARRAY['owner', 'accountant'])
          OR (
            public.has_org_role(i.org_id, ARRAY['staff'])
            AND i.status = 'DRAFT'
            AND i.created_by = auth.uid()
          )
        )
    )
  );

CREATE POLICY "invoice_items_delete_by_role"
  ON public.invoice_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id
        AND (
          public.has_org_role(i.org_id, ARRAY['owner', 'accountant'])
          OR (
            public.has_org_role(i.org_id, ARRAY['staff'])
            AND i.status = 'DRAFT'
            AND i.created_by = auth.uid()
          )
        )
    )
  );

-- 5.9 audit_logs (Read-only for org members; writes exclusively via trigger)
CREATE POLICY "audit_logs_select_member"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id));
