-- ============================================================================
-- KRONOS LEDGER — 06_org_onboarding_and_coa_seeder.sql
-- Default Chart of Accounts Seeder & Organization Onboarding Trigger
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DEFAULT CHART OF ACCOUNTS SEEDER & ORG ONBOARDING
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_default_coa(target_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF target_org_id IS NULL THEN
    RAISE EXCEPTION 'target_org_id cannot be NULL';
  END IF;

  -- Guard direct RPC calls from authenticated clients outside owner/accountant
  IF auth.uid() IS NOT NULL
     AND COALESCE(current_setting('kronos.internal_org_seed', true), 'false') <> 'true'
     AND NOT public.has_org_role(target_org_id, ARRAY['owner', 'accountant']) THEN
    RAISE EXCEPTION 'Insufficient privileges to seed Chart of Accounts for organization %', target_org_id
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.accounts (org_id, code, name, category, normal_balance, is_system)
  VALUES
    (target_org_id, '1101', 'Kas Tunai',                  'ASSET',     'DEBIT',  true),
    (target_org_id, '1102', 'Bank BCA',                   'ASSET',     'DEBIT',  true),
    (target_org_id, '1201', 'Piutang Usaha',              'ASSET',     'DEBIT',  true),
    (target_org_id, '1301', 'Persediaan Barang',          'ASSET',     'DEBIT',  true),
    (target_org_id, '2101', 'Utang Usaha',                'LIABILITY', 'CREDIT', true),
    (target_org_id, '2201', 'Utang Pajak PPN/PPh',        'LIABILITY', 'CREDIT', true),
    (target_org_id, '3101', 'Modal Pemilik',              'EQUITY',    'CREDIT', true),
    (target_org_id, '3201', 'Laba Ditahan',               'EQUITY',    'CREDIT', true),
    (target_org_id, '4101', 'Penjualan Produk',           'REVENUE',   'CREDIT', true),
    (target_org_id, '4102', 'Pendapatan Jasa',            'REVENUE',   'CREDIT', true),
    (target_org_id, '5101', 'Harga Pokok Penjualan',      'COGS',      'DEBIT',  true),
    (target_org_id, '6101', 'Beban Operasional',          'EXPENSE',   'DEBIT',  true),
    (target_org_id, '6102', 'Beban Gaji',                 'EXPENSE',   'DEBIT',  false),
    (target_org_id, '6103', 'Beban Listrik & Internet',   'EXPENSE',   'DEBIT',  false),
    (target_org_id, '6104', 'Beban Marketing',            'EXPENSE',   'DEBIT',  false)
  ON CONFLICT (org_id, code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Auto-assign creator as owner first so tenant membership exists immediately
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;

  PERFORM set_config('kronos.internal_org_seed', 'true', true);
  PERFORM public.seed_default_coa(NEW.id);
  PERFORM set_config('kronos.internal_org_seed', 'false', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_after_insert ON public.organizations;
CREATE TRIGGER trg_organizations_after_insert
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_organization();
