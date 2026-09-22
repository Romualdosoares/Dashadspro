-- DashAds Pro feature catalog and organization access migration.
-- Run after supabase-crm-phase-1.sql in the Supabase SQL editor.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.product_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]{2,80}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_feature_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.product_features(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, feature_id)
);

CREATE INDEX IF NOT EXISTS product_features_status_position_idx
  ON public.product_features (status, position);
CREATE INDEX IF NOT EXISTS organization_feature_accesses_organization_idx
  ON public.organization_feature_accesses (organization_id);

CREATE OR REPLACE FUNCTION public.set_product_features_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_features_updated_at() FROM PUBLIC;

DROP TRIGGER IF EXISTS product_features_set_updated_at ON public.product_features;
CREATE TRIGGER product_features_set_updated_at
  BEFORE UPDATE ON public.product_features
  FOR EACH ROW EXECUTE FUNCTION public.set_product_features_updated_at();

INSERT INTO public.product_features (key, name, description, status, position)
VALUES
  ('dashboard_ads', 'Dashboard de anúncios', 'Acompanhe métricas e campanhas de anúncios.', 'active', 10),
  ('crm', 'CRM', 'Gerencie contatos, leads e oportunidades.', 'active', 20),
  ('site_builder', 'Criador de sites', 'Crie e publique páginas para suas campanhas.', 'active', 30)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  position = EXCLUDED.position,
  status = CASE
    WHEN public.product_features.status = 'archived' THEN 'archived'
    ELSE EXCLUDED.status
  END;

ALTER TABLE public.product_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_feature_accesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_features_authenticated_read" ON public.product_features;
DROP POLICY IF EXISTS "product_features_admin_write" ON public.product_features;
DROP POLICY IF EXISTS "organization_feature_accesses_member_read" ON public.organization_feature_accesses;
DROP POLICY IF EXISTS "organization_feature_accesses_admin_write" ON public.organization_feature_accesses;

CREATE POLICY "product_features_authenticated_read"
  ON public.product_features FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_features_admin_write"
  ON public.product_features FOR ALL
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "organization_feature_accesses_member_read"
  ON public.organization_feature_accesses FOR SELECT
  TO authenticated
  USING (public.can_access_organization(organization_id));

CREATE POLICY "organization_feature_accesses_admin_write"
  ON public.organization_feature_accesses FOR ALL
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

REVOKE ALL ON TABLE public.product_features FROM PUBLIC;
REVOKE ALL ON TABLE public.organization_feature_accesses FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_features TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_feature_accesses TO authenticated;

COMMIT;
