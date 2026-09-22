import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase-crm-phase-1.sql");
const featureAccessMigrationPath = resolve(process.cwd(), "supabase-feature-access.sql");

function readMigration() {
  return readFileSync(migrationPath, "utf8");
}

function readFeatureAccessMigration() {
  return readFileSync(featureAccessMigrationPath, "utf8");
}

describe("CRM Phase 1 schema migration", () => {
  it("defines an idempotent transaction with organization and CRM tables", () => {
    const sql = readMigration();

    expect(sql).toMatch(/\bBEGIN\s*;/i);
    expect(sql).toMatch(/\bCOMMIT\s*;/i);
    for (const table of [
      "organizations",
      "organization_memberships",
      "crm_pipeline_stages",
      "crm_contacts",
      "crm_leads",
      "crm_deals",
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`, "i"));
    }
  });

  it("enforces organization, membership, contact and CRM contracts", () => {
    const sql = readMigration();

    expect(sql).toMatch(/name\s+text\s+not null\s+check\s*\(char_length\(name\) between 2 and 120\)/i);
    expect(sql).toMatch(/slug\s+text\s+not null\s+unique\s+check\s*\(slug ~ '\^\[a-z0-9-\]\{3,80\}\$'\)/i);
    expect(sql).toMatch(/primary key\s*\(organization_id, user_id\)/i);
    expect(sql).toMatch(/role\s+text\s+not null\s+check\s*\(role in \('owner', 'manager', 'agent'\)\)/i);
    expect(sql).toMatch(/check\s*\(phone is not null or email is not null\)/i);
    expect(sql).toMatch(/source\s+text\s+not null\s+check\s*\(source in \('manual', 'landing_page', 'whatsapp'\)\)/i);
    expect(sql).toMatch(/status\s+text\s+not null\s+default 'open'\s+check\s*\(status in \('open', 'won', 'lost'\)\)/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_organization_phone_unique[\s\S]*WHERE phone IS NOT NULL/i);
    expect(sql).toMatch(/DROP INDEX IF EXISTS public\.crm_contacts_organization_email_unique/i);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_organization_email_unique[\s\S]*ON public\.crm_contacts \(organization_id, lower\(email\)\) WHERE email IS NOT NULL/i);
    expect(sql).toMatch(/UPDATE public\.crm_contacts\s+SET email = lower\(email\)\s+WHERE email IS NOT NULL/i);
    expect(sql).toMatch(/UPDATE public\.crm_leads AS lead[\s\S]*SET contact_id = duplicates\.canonical_contact_id/i);
    expect(sql).toMatch(/DELETE FROM public\.crm_contacts AS duplicate[\s\S]*USING duplicate_contacts AS duplicates/i);
  });

  it("bootstraps personal organizations and default pipeline stages", () => {
    const sql = readMigration();

    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.bootstrap_personal_organization\(target_user_id uuid, display_name text\)/i);
    expect(sql).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = public/i);
    expect(sql).toMatch(/'user-' \|\| replace\(target_user_id::text, '-', ''\)/i);
    expect(sql).toMatch(/IF char_length\(personal_name\) < 2 THEN[\s\S]*personal_name := 'Personal organization';/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.bootstrap_personal_organization\(uuid, text\) FROM PUBLIC/i);
    const bootstrapBody = sql.match(
      /CREATE OR REPLACE FUNCTION public\.bootstrap_personal_organization\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/i,
    )?.[1];
    expect(bootstrapBody).toBeDefined();
    expect(bootstrapBody).not.toMatch(/ON CONFLICT \(slug\) DO UPDATE/i);
    expect(bootstrapBody).toMatch(/PERFORM pg_advisory_xact_lock\(hashtextextended\(target_user_id::text, 0\)\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.create_default_pipeline_stages\(\)/i);
    for (const stage of ["Novo lead", "Em atendimento", "Qualificado", "Proposta", "Vendido", "Perdido"]) {
      expect(sql).toContain(`'${stage}'`);
    }
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/i);
    expect(sql).toMatch(/PERFORM public\.bootstrap_personal_organization\(\s*NEW\.id/i);
    expect(sql).toMatch(/FROM auth\.users/i);
  });

  it("backfills existing Meta data and scopes access with RLS", () => {
    const sql = readMigration();

    expect(sql).toMatch(/ALTER TABLE public\.facebook_tokens\s+ADD COLUMN IF NOT EXISTS organization_id uuid/i);
    expect(sql).toMatch(/ALTER TABLE public\.ad_accounts\s+ADD COLUMN IF NOT EXISTS organization_id uuid/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS facebook_tokens_organization_idx/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS ad_accounts_organization_idx/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.assign_organization_to_user_owned_data\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = public/i);
    expect(sql).toMatch(/CREATE TRIGGER assign_facebook_tokens_organization\s+BEFORE INSERT OR UPDATE OF user_id, organization_id ON public\.facebook_tokens/i);
    expect(sql).toMatch(/CREATE TRIGGER assign_ad_accounts_organization\s+BEFORE INSERT OR UPDATE OF user_id, organization_id ON public\.ad_accounts/i);
    const metaOrganizationTriggerBody = sql.match(
      /CREATE OR REPLACE FUNCTION public\.assign_organization_to_user_owned_data\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/i,
    )?.[1];
    expect(metaOrganizationTriggerBody).toBeDefined();
    expect(metaOrganizationTriggerBody).toMatch(/NEW\.organization_id := resolved_organization_id;/i);
    expect(metaOrganizationTriggerBody).not.toMatch(/IF NEW\.organization_id IS NULL THEN/i);
    expect(sql).toMatch(/ALTER TABLE public\.facebook_tokens\s+ALTER COLUMN organization_id SET NOT NULL/i);
    expect(sql).toMatch(/ALTER TABLE public\.ad_accounts\s+ALTER COLUMN organization_id SET NOT NULL/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.can_access_organization\(target_organization_id uuid\)/i);
    expect(sql).toMatch(/auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'\s*=\s*'admin'/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.can_access_organization\(uuid\) FROM PUBLIC/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.can_access_organization\(uuid\) TO authenticated, service_role/i);
    for (const [table, legacyPolicy, organizationPolicy] of [
      ["facebook_tokens", "Users can manage own tokens", "organization members manage facebook tokens"],
      ["ad_accounts", "Users can manage own ad accounts", "organization members manage ad accounts"],
    ]) {
      expect(sql).toMatch(new RegExp(`DROP POLICY IF EXISTS "${legacyPolicy}" ON public\\.${table}`, "i"));
      expect(sql).toMatch(new RegExp(`CREATE POLICY "${organizationPolicy}"[\\s\\S]*?ON public\\.${table} FOR ALL[\\s\\S]*?USING \\(public\\.can_access_organization\\(organization_id\\)\\)[\\s\\S]*?WITH CHECK \\(public\\.can_access_organization\\(organization_id\\)\\)`, "i"));
    }

    for (const table of [
      "organizations",
      "organization_memberships",
      "crm_pipeline_stages",
      "crm_contacts",
      "crm_leads",
      "crm_deals",
    ]) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, "i"));
    }

    expect(sql).toMatch(/CREATE POLICY "organization members read organizations"/i);
    expect(sql).toMatch(/CREATE POLICY "organization members read memberships"/i);
    for (const name of ["stages", "contacts", "leads", "deals"]) {
      expect(sql).toMatch(new RegExp(`CREATE POLICY "organization members manage ${name}"`, "i"));
    }
  });

  it("serializes same-organization lead contact matching before identity row locks", () => {
    const sql = readMigration();
    const createLeadBody = sql.match(
      /CREATE OR REPLACE FUNCTION public\.create_crm_lead\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/i,
    )?.[1];

    expect(createLeadBody).toBeDefined();
    expect(createLeadBody).toMatch(
      /PERFORM pg_advisory_xact_lock\(hashtextextended\(target_organization_id::text, 0\)\);/i,
    );
    expect(createLeadBody!.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      createLeadBody!.indexOf("FOR UPDATE"),
    );
  });
});

describe("organization feature access schema migration", () => {
  it("defines idempotent catalog and organization access tables", () => {
    const sql = readFeatureAccessMigration();

    expect(sql).toMatch(/\bBEGIN\s*;/i);
    expect(sql).toMatch(/\bCOMMIT\s*;/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.product_features/i);
    expect(sql).toMatch(/id\s+uuid\s+PRIMARY KEY/i);
    expect(sql).toMatch(/key\s+text\s+NOT NULL\s+UNIQUE/i);
    expect(sql).toMatch(/name\s+text\s+NOT NULL/i);
    expect(sql).toMatch(/description\s+text\s+NOT NULL\s+DEFAULT ''/i);
    expect(sql).toMatch(/status\s+text\s+NOT NULL\s+DEFAULT 'active'\s+CHECK\s*\(status IN \('active', 'archived'\)\)/i);
    expect(sql).toMatch(/position\s+integer\s+NOT NULL\s+DEFAULT 0\s+CHECK\s*\(position >= 0\)/i);
    expect(sql).toMatch(/created_at\s+timestamptz\s+NOT NULL\s+DEFAULT now\(\)/i);
    expect(sql).toMatch(/updated_at\s+timestamptz\s+NOT NULL\s+DEFAULT now\(\)/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.set_product_features_updated_at\(\)[\s\S]*?NEW\.updated_at := now\(\)/i);
    expect(sql).toMatch(/CREATE TRIGGER product_features_set_updated_at\s+BEFORE UPDATE ON public\.product_features[\s\S]*?EXECUTE FUNCTION public\.set_product_features_updated_at\(\)/i);

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.organization_feature_accesses/i);
    expect(sql).toMatch(/organization_id\s+uuid\s+NOT NULL\s+REFERENCES public\.organizations\(id\)/i);
    expect(sql).toMatch(/feature_id\s+uuid\s+NOT NULL\s+REFERENCES public\.product_features\(id\)/i);
    expect(sql).toContain("UNIQUE (organization_id, feature_id)");
  });

  it("seeds ordered catalog values without reactivating archived features", () => {
    const sql = readFeatureAccessMigration();

    expect(sql).toMatch(/INSERT INTO public\.product_features \(key, name, description, status, position\)[\s\S]*?'dashboard_ads'[\s\S]*?'crm'[\s\S]*?'site_builder'[\s\S]*?ON CONFLICT \(key\) DO UPDATE/i);
    expect(sql).toMatch(/^\s*\('dashboard_ads',[^)]*'active', 10\),/im);
    expect(sql).toMatch(/^\s*\('crm',[^)]*'active', 20\),/im);
    expect(sql).toMatch(/^\s*\('site_builder',[^)]*'active', 30\)/im);
    expect(sql).toMatch(/ON CONFLICT \(key\) DO UPDATE\s+SET\s+name = EXCLUDED\.name,\s+description = EXCLUDED\.description,\s+position = EXCLUDED\.position,/i);
    expect(sql).toMatch(/WHEN public\.product_features\.status = 'archived' THEN 'archived'/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS product_features_status_position_idx\s+ON public\.product_features \(status, position\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS organization_feature_accesses_organization_idx\s+ON public\.organization_feature_accesses \(organization_id\)/i);
  });

  it("enables RLS with member reads and JWT-admin writes", () => {
    const sql = readFeatureAccessMigration();
    const jwtAdmin = "auth\\.jwt\\(\\)\\s*->\\s*'app_metadata'\\s*->>\\s*'role'\\s*=\\s*'admin'";

    expect(sql).toMatch(/ALTER TABLE public\.product_features ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/ALTER TABLE public\.organization_feature_accesses ENABLE ROW LEVEL SECURITY/i);
    for (const [table, policy] of [
      ["product_features", "product_features_authenticated_read"],
      ["product_features", "product_features_admin_write"],
      ["organization_feature_accesses", "organization_feature_accesses_member_read"],
      ["organization_feature_accesses", "organization_feature_accesses_admin_write"],
    ]) {
      expect(sql).toMatch(new RegExp(`DROP POLICY IF EXISTS "${policy}" ON public\\.${table}`, "i"));
    }
    expect(sql).toMatch(/CREATE POLICY "product_features_authenticated_read"\s+ON public\.product_features FOR SELECT\s+TO authenticated\s+USING \(true\)/i);
    expect(sql).toMatch(/CREATE POLICY "organization_feature_accesses_member_read"[\s\S]*?ON public\.organization_feature_accesses FOR SELECT[\s\S]*?USING \(public\.can_access_organization\(organization_id\)\)/i);

    for (const [table, policy] of [
      ["product_features", "product_features_admin_write"],
      ["organization_feature_accesses", "organization_feature_accesses_admin_write"],
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY "${policy}"[\\s\\S]*?ON public\\.${table} FOR ALL[\\s\\S]*?USING \\(${jwtAdmin}\\)[\\s\\S]*?WITH CHECK \\(${jwtAdmin}\\)`,
          "i",
        ),
      );
    }
  });
});
