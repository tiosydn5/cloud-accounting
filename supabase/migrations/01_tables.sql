-- ============================================================================
-- KRONOS LEDGER — 01_tables.sql
-- Core Multi-Tenant Accounting & Mini-ERP Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- 1.1 Organizations (Multi-tenant root)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.50 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 Organization Members (RBAC)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'accountant', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- 1.3 Chart of Accounts (CoA)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (char_length(trim(code)) > 0),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  category TEXT NOT NULL CHECK (category IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

-- 1.4 Transactions Header
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tx_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_no TEXT,
  description TEXT NOT NULL CHECK (char_length(trim(description)) > 0),
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING', 'POSTED', 'VOID')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.5 Journal Lines (Double-Entry Detail)
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
  credit NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
  CHECK (debit > 0 OR credit > 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

-- 1.6 Products & Inventory (COGS Engine)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL CHECK (char_length(trim(sku)) > 0),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  cost_price NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
  sell_price NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (sell_price >= 0),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, sku)
);

-- 1.7 Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL CHECK (char_length(trim(invoice_number)) > 0),
  client_name TEXT NOT NULL CHECK (char_length(trim(client_name)) > 0),
  client_contact TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, invoice_number)
);

-- 1.8 Invoice Items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL CHECK (char_length(trim(description)) > 0),
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0)
);

-- 1.9 Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
