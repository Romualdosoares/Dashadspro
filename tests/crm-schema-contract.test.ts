import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase-crm-phase-1.sql");

function readMigration() {
  return readFileSync(migrationPath, "utf8");
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
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_organization_email_unique[\s\S]*WHERE email IS NOT NULL/i);
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
    expect(sql).toMatch(/ALTER TABLE public\.facebook_tokens\s+ALTER COLUMN organization_id SET NOT NULL/i);
    expect(sql).toMatch(/ALTER TABLE public\.ad_accounts\s+ALTER COLUMN organization_id SET NOT NULL/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.can_access_organization\(target_organization_id uuid\)/i);
    expect(sql).toMatch(/auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'\s*=\s*'admin'/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.can_access_organization\(uuid\) FROM PUBLIC/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.can_access_organization\(uuid\) TO authenticated, service_role/i);

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
});
