-- ============================================================================
-- KRONOS LEDGER — 03_rls_policies_core.sql
-- RLS Policies: organizations, organization_members, accounts, transactions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5. RLS POLICIES
-- ----------------------------------------------------------------------------

-- 5.1 organizations
CREATE POLICY "organizations_select_member"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.is_org_member(id) OR created_by = auth.uid());

CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "organizations_update_owner"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.has_org_role(id, ARRAY['owner']))
  WITH CHECK (public.has_org_role(id, ARRAY['owner']));

CREATE POLICY "organizations_delete_owner"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (public.has_org_role(id, ARRAY['owner']));

-- 5.2 organization_members
CREATE POLICY "org_members_select_member"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "org_members_insert_owner"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner']));

CREATE POLICY "org_members_update_owner"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner']))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner']));

CREATE POLICY "org_members_delete_owner_or_self"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner']) OR user_id = auth.uid());

-- 5.3 accounts (CoA)
CREATE POLICY "accounts_select_member"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "accounts_insert_owner_accountant"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner', 'accountant']));

CREATE POLICY "accounts_update_owner_accountant"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner', 'accountant']))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner', 'accountant']));

CREATE POLICY "accounts_delete_owner_accountant_non_system"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner', 'accountant']) AND is_system = false);

-- 5.4 transactions
CREATE POLICY "transactions_select_member"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "transactions_insert_by_role"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (public.has_org_role(org_id, ARRAY['owner', 'accountant']) AND status IN ('PENDING', 'POSTED'))
      OR (public.has_org_role(org_id, ARRAY['staff']) AND status = 'PENDING')
    )
  );

CREATE POLICY "transactions_update_owner_accountant"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner', 'accountant']))
  WITH CHECK (public.has_org_role(org_id, ARRAY['owner', 'accountant']));

CREATE POLICY "transactions_update_staff_own_pending"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (
    public.has_org_role(org_id, ARRAY['staff'])
    AND status = 'PENDING'
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.has_org_role(org_id, ARRAY['staff'])
    AND status = 'PENDING'
    AND created_by = auth.uid()
  );

CREATE POLICY "transactions_delete_owner_or_pending"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (
    public.has_org_role(org_id, ARRAY['owner'])
    OR (public.has_org_role(org_id, ARRAY['accountant']) AND status = 'PENDING')
    OR (public.has_org_role(org_id, ARRAY['staff']) AND status = 'PENDING' AND created_by = auth.uid())
  );
