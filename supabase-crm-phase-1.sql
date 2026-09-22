-- DashAds Pro CRM Phase 1: additive multi-tenant schema migration.
-- Run after supabase-setup.sql in the Supabase SQL editor.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  position integer NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, position)
);

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('manual', 'landing_page', 'whatsapp')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, contact_id)
    REFERENCES public.crm_contacts(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, stage_id)
    REFERENCES public.crm_pipeline_stages(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = upper(currency) AND char_length(currency) = 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, lead_id)
    REFERENCES public.crm_leads(organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS organization_memberships_organization_user_idx
  ON public.organization_memberships (organization_id, user_id);
CREATE INDEX IF NOT EXISTS organization_memberships_user_organization_idx
  ON public.organization_memberships (user_id, organization_id);
CREATE INDEX IF NOT EXISTS crm_pipeline_stages_organization_position_idx
  ON public.crm_pipeline_stages (organization_id, position);
CREATE INDEX IF NOT EXISTS crm_contacts_organization_created_idx
  ON public.crm_contacts (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_organization_stage_created_idx
  ON public.crm_leads (organization_id, stage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_organization_contact_idx
  ON public.crm_leads (organization_id, contact_id);
CREATE INDEX IF NOT EXISTS crm_deals_organization_status_created_idx
  ON public.crm_deals (organization_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_organization_phone_unique
  ON public.crm_contacts (organization_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_organization_email_unique
  ON public.crm_contacts (organization_id, email) WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_pipeline_stages (organization_id, name, position)
  VALUES
    (NEW.id, 'Novo lead', 1),
    (NEW.id, 'Em atendimento', 2),
    (NEW.id, 'Qualificado', 3),
    (NEW.id, 'Proposta', 4),
    (NEW.id, 'Vendido', 5),
    (NEW.id, 'Perdido', 6)
  ON CONFLICT (organization_id, position) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_pipeline_stages();

CREATE OR REPLACE FUNCTION public.bootstrap_personal_organization(target_user_id uuid, display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  personal_organization_id uuid;
  personal_name text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(target_user_id::text, 0));

  SELECT organization_id
    INTO personal_organization_id
    FROM public.organization_memberships
    WHERE user_id = target_user_id
      AND role = 'owner'
    ORDER BY created_at ASC
    LIMIT 1;

  IF personal_organization_id IS NOT NULL THEN
    RETURN personal_organization_id;
  END IF;

  personal_name := left(COALESCE(NULLIF(btrim(display_name), ''), 'Personal organization'), 120);
  IF char_length(personal_name) < 2 THEN
    personal_name := 'Personal organization';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE slug = 'user-' || replace(target_user_id::text, '-', '')
  ) THEN
    RAISE EXCEPTION
      'Cannot bootstrap personal organization for user %: personal slug already exists without owner membership',
      target_user_id;
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (
    personal_name,
    'user-' || replace(target_user_id::text, '-', '')
  )
  RETURNING id INTO personal_organization_id;

  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (personal_organization_id, target_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN personal_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_personal_organization(uuid, text) FROM PUBLIC;

SELECT public.bootstrap_personal_organization(
  id,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
)
FROM auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.bootstrap_personal_organization(
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email)
  );

  RETURN NEW;
END;
$$;

ALTER TABLE public.facebook_tokens
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

UPDATE public.facebook_tokens AS facebook_token
SET organization_id = (
  SELECT membership.organization_id
  FROM public.organization_memberships AS membership
  WHERE membership.user_id = facebook_token.user_id
    AND membership.role = 'owner'
  ORDER BY membership.created_at ASC
  LIMIT 1
)
WHERE facebook_token.organization_id IS NULL;

UPDATE public.ad_accounts AS ad_account
SET organization_id = (
  SELECT membership.organization_id
  FROM public.organization_memberships AS membership
  WHERE membership.user_id = ad_account.user_id
    AND membership.role = 'owner'
  ORDER BY membership.created_at ASC
  LIMIT 1
)
WHERE ad_account.organization_id IS NULL;

CREATE OR REPLACE FUNCTION public.assign_organization_to_user_owned_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_organization_id uuid;
BEGIN
  SELECT organization_id
    INTO resolved_organization_id
    FROM public.organization_memberships
    WHERE user_id = NEW.user_id
      AND role = 'owner'
    ORDER BY created_at ASC
    LIMIT 1;

  IF resolved_organization_id IS NULL THEN
    RAISE EXCEPTION 'Cannot assign organization for user %: no owner membership found', NEW.user_id;
  END IF;

  NEW.organization_id := resolved_organization_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_organization_to_user_owned_data() FROM PUBLIC;

DROP TRIGGER IF EXISTS assign_facebook_tokens_organization ON public.facebook_tokens;
CREATE TRIGGER assign_facebook_tokens_organization
  BEFORE INSERT OR UPDATE OF user_id, organization_id ON public.facebook_tokens
  FOR EACH ROW EXECUTE FUNCTION public.assign_organization_to_user_owned_data();

DROP TRIGGER IF EXISTS assign_ad_accounts_organization ON public.ad_accounts;
CREATE TRIGGER assign_ad_accounts_organization
  BEFORE INSERT OR UPDATE OF user_id, organization_id ON public.ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.assign_organization_to_user_owned_data();

ALTER TABLE public.facebook_tokens
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.ad_accounts
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS facebook_tokens_organization_idx
  ON public.facebook_tokens (organization_id);
CREATE INDEX IF NOT EXISTS ad_accounts_organization_idx
  ON public.ad_accounts (organization_id);

CREATE OR REPLACE FUNCTION public.can_access_organization(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships
      WHERE organization_id = target_organization_id
        AND user_id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_organization(uuid) TO authenticated, service_role;

ALTER TABLE public.facebook_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tokens" ON public.facebook_tokens;
DROP POLICY IF EXISTS "organization members manage facebook tokens" ON public.facebook_tokens;
DROP POLICY IF EXISTS "Users can manage own ad accounts" ON public.ad_accounts;
DROP POLICY IF EXISTS "organization members manage ad accounts" ON public.ad_accounts;

CREATE POLICY "organization members manage facebook tokens"
  ON public.facebook_tokens FOR ALL
  USING (public.can_access_organization(organization_id))
  WITH CHECK (public.can_access_organization(organization_id));

CREATE POLICY "organization members manage ad accounts"
  ON public.ad_accounts FOR ALL
  USING (public.can_access_organization(organization_id))
  WITH CHECK (public.can_access_organization(organization_id));

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization members read organizations" ON public.organizations;
DROP POLICY IF EXISTS "organization members read memberships" ON public.organization_memberships;
DROP POLICY IF EXISTS "organization members manage stages" ON public.crm_pipeline_stages;
DROP POLICY IF EXISTS "organization members manage contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "organization members manage leads" ON public.crm_leads;
DROP POLICY IF EXISTS "organization members manage deals" ON public.crm_deals;

CREATE POLICY "organization members read organizations"
  ON public.organizations FOR SELECT
  USING (public.can_access_organization(id));

CREATE POLICY "organization members read memberships"
  ON public.organization_memberships FOR SELECT
  USING (public.can_access_organization(organization_id));

CREATE POLICY "organization members manage stages"
  ON public.crm_pipeline_stages FOR ALL
  USING (public.can_access_organization(organization_id))
  WITH CHECK (public.can_access_organization(organization_id));

CREATE POLICY "organization members manage contacts"
  ON public.crm_contacts FOR ALL
  USING (public.can_access_organization(organization_id))
  WITH CHECK (public.can_access_organization(organization_id));

CREATE POLICY "organization members manage leads"
  ON public.crm_leads FOR ALL
  USING (public.can_access_organization(organization_id))
  WITH CHECK (public.can_access_organization(organization_id));

CREATE POLICY "organization members manage deals"
  ON public.crm_deals FOR ALL
  USING (public.can_access_organization(organization_id))
  WITH CHECK (public.can_access_organization(organization_id));

COMMIT;
