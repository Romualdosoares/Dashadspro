# CRM Multi-tenant Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a usable, isolated CRM core in DashAds with organizations, memberships, contacts, leads and pipeline stages, plus deal storage for Phase 4 attribution.

**Architecture:** Add a dedicated organization boundary in Supabase, then resolve the active organization from authenticated membership in server routes. Keep `/crm` independent from the large legacy dashboard component. Existing users receive a personal organization in a reversible migration, while global platform administration remains `app_metadata.role = admin`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres/RLS, Vitest, Tailwind CSS.

---

## Scope boundary

This is Phase 1 from the approved design. It delivers a working CRM core only. Landing-page generation, domain hosting, static export, Z-API webhooks, automations and revenue-to-Meta reporting are separate dependency-ordered plans after this phase passes verification.

## File structure

- Create: `supabase-crm-phase-1.sql` — production-safe schema migration, backfill, RLS and organization bootstrap triggers.
- Create: `lib/auth-role.ts` — one source of truth for platform role display.
- Create: `lib/organization-access.ts` — active-organization lookup and membership authorization.
- Create: `lib/crm-types.ts` — public CRM types shared by routes and UI.
- Create: `lib/crm-validation.ts` — input validation and phone normalization for CRM writes.
- Create: `app/api/crm/context/route.ts` — authenticated organization and pipeline context.
- Create: `app/api/crm/leads/route.ts` — authenticated lead list and creation endpoint.
- Create: `app/api/crm/leads/[leadId]/route.ts` — authenticated lead stage update endpoint.
- Create: `app/crm/page.tsx` — server-side authentication boundary for CRM.
- Create: `app/crm/CrmClient.tsx` — small CRM list, pipeline movement and new lead form.
- Modify: `app/dashboard/page.tsx` — read dashboard role from `app_metadata`, not mutable user metadata.
- Modify: `DashAdsPro.tsx` — add a `/crm` navigation link beside the existing admin link.
- Create: `tests/auth-role.test.ts`, `tests/crm-validation.test.ts`, `tests/organization-access.test.ts` — focused unit tests.

### Task 1: Define platform role and CRM validation helpers

**Files:**
- Create: `lib/auth-role.ts`
- Create: `lib/crm-types.ts`
- Create: `lib/crm-validation.ts`
- Create: `tests/auth-role.test.ts`
- Create: `tests/crm-validation.test.ts`

- [ ] **Step 1: Write failing role-resolution test**

```ts
import { describe, expect, it } from "vitest";
import { getPlatformRole } from "../lib/auth-role";

describe("getPlatformRole", () => {
  it("uses protected app metadata and ignores user metadata", () => {
    expect(getPlatformRole({ app_metadata: { role: "admin" }, user_metadata: { role: "user" } })).toBe("admin");
  });

  it("defaults unknown roles to user", () => {
    expect(getPlatformRole({ app_metadata: { role: "master" } })).toBe("user");
  });
});
```

- [ ] **Step 2: Run role test and verify failure**

Run: `npm test -- tests/auth-role.test.ts`

Expected: FAIL because `../lib/auth-role` does not exist.

- [ ] **Step 3: Implement role helper and CRM types**

```ts
// lib/auth-role.ts
export type PlatformRole = "admin" | "user";

export function getPlatformRole(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): PlatformRole {
  return user.app_metadata?.role === "admin" ? "admin" : "user";
}
```

```ts
// lib/crm-types.ts
export type OrganizationRole = "owner" | "manager" | "agent";
export type LeadSource = "manual" | "landing_page" | "whatsapp";
export type LeadStatus = "open" | "won" | "lost";

export interface CrmStage { id: string; name: string; position: number; }
export interface CrmLead {
  id: string; contact_id: string; stage_id: string; source: LeadSource;
  status: LeadStatus; contact_name: string; contact_phone: string | null;
  contact_email: string | null; created_at: string;
}
```

- [ ] **Step 4: Write failing CRM validation tests**

```ts
import { describe, expect, it } from "vitest";
import { validateLeadCreate, validateLeadStageUpdate } from "../lib/crm-validation";

describe("CRM validation", () => {
  it("normalizes a Brazilian phone and accepts an allowed source", () => {
    expect(validateLeadCreate({ name: "Ana", phone: "(11) 98888-7777", source: "whatsapp" })).toEqual({
      ok: true,
      value: { name: "Ana", phone: "5511988887777", email: null, source: "whatsapp" },
    });
  });

  it("rejects missing name, invalid phone and unknown source", () => {
    expect(validateLeadCreate({ name: "", phone: "123", source: "instagram" }).ok).toBe(false);
  });

  it("requires a UUID stage identifier", () => {
    expect(validateLeadStageUpdate({ stage_id: "not-a-uuid" }).ok).toBe(false);
  });
});
```

- [ ] **Step 5: Run validation test and verify failure**

Run: `npm test -- tests/crm-validation.test.ts`

Expected: FAIL because `../lib/crm-validation` does not exist.

- [ ] **Step 6: Implement validation helper**

```ts
import { normalizeBrazilianPhone } from "./report-schedule";
import type { LeadSource } from "./crm-types";

const SOURCES = new Set<LeadSource>(["manual", "landing_page", "whatsapp"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateLeadCreate(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase() || null;
  const source = String(body.source ?? "manual") as LeadSource;
  if (name.length < 2 || name.length > 120 || !SOURCES.has(source)) return { ok: false as const, error: "Lead inválido" };
  let phone: string | null = null;
  if (body.phone) {
    try { phone = normalizeBrazilianPhone(String(body.phone)); }
    catch { return { ok: false as const, error: "Telefone inválido" }; }
  }
  if (!phone && !email) return { ok: false as const, error: "Informe telefone ou e-mail" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "E-mail inválido" };
  return { ok: true as const, value: { name, phone, email, source } };
}

export function validateLeadStageUpdate(body: Record<string, unknown>) {
  const stageId = String(body.stage_id ?? "");
  return UUID.test(stageId)
    ? { ok: true as const, value: { stage_id: stageId } }
    : { ok: false as const, error: "Etapa inválida" };
}
```

- [ ] **Step 7: Run helper tests and commit**

Run: `npm test -- tests/auth-role.test.ts tests/crm-validation.test.ts`

Expected: PASS.

```bash
git add lib/auth-role.ts lib/crm-types.ts lib/crm-validation.ts tests/auth-role.test.ts tests/crm-validation.test.ts
git commit -m "feat: add CRM validation primitives"
```

### Task 2: Add organization schema, migration and row-level security

**Files:**
- Create: `supabase-crm-phase-1.sql`

- [ ] **Step 1: Write migration SQL with tenant schema and backfill**

```sql
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'agent')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.bootstrap_personal_organization(target_user_id uuid, display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare organization_id uuid;
begin
  select om.organization_id into organization_id from public.organization_memberships om
  where om.user_id = target_user_id and om.role = 'owner' limit 1;
  if organization_id is not null then return organization_id; end if;
  insert into public.organizations (name, slug)
  values (coalesce(nullif(trim(display_name), ''), 'Minha organização'), 'user-' || replace(target_user_id::text, '-', ''))
  returning id into organization_id;
  insert into public.organization_memberships (organization_id, user_id, role)
  values (organization_id, target_user_id, 'owner');
  return organization_id;
end;
$$;
```

- [ ] **Step 2: Add CRM tables, default stages and indexes in same migration**

```sql
create table public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60), position smallint not null check (position between 0 and 99),
  unique (organization_id, position)
);
create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, phone text, email text, consent_at timestamptz, created_at timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create table public.crm_leads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.crm_contacts(id) on delete restrict,
  stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  source text not null check (source in ('manual', 'landing_page', 'whatsapp')),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  created_at timestamptz not null default now()
);
create table public.crm_deals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  amount numeric(14,2), currency char(3) not null default 'BRL', created_at timestamptz not null default now()
);
create index crm_leads_organization_stage_idx on public.crm_leads (organization_id, stage_id, created_at desc);
create index crm_contacts_organization_phone_idx on public.crm_contacts (organization_id, phone);
create unique index crm_contacts_organization_phone_unique on public.crm_contacts (organization_id, phone) where phone is not null;
create unique index crm_contacts_organization_email_unique on public.crm_contacts (organization_id, email) where email is not null;

create or replace function public.seed_default_pipeline_stages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.crm_pipeline_stages (organization_id, name, position) values
    (new.id, 'Novo lead', 0), (new.id, 'Em atendimento', 1), (new.id, 'Qualificado', 2),
    (new.id, 'Proposta', 3), (new.id, 'Vendido', 4), (new.id, 'Perdido', 5);
  return new;
end;
$$;
drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created after insert on public.organizations
for each row execute function public.seed_default_pipeline_stages();

select public.bootstrap_personal_organization(id, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email))
from auth.users;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  perform public.bootstrap_personal_organization(new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;
```

- [ ] **Step 3: Add RLS helpers, policies, onboarding trigger and legacy asset backfill**

```sql
create or replace function public.can_access_organization(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
      or exists (select 1 from public.organization_memberships where organization_id = target_organization_id and user_id = auth.uid());
$$;

alter table public.facebook_tokens add column if not exists organization_id uuid references public.organizations(id);
alter table public.ad_accounts add column if not exists organization_id uuid references public.organizations(id);
update public.facebook_tokens ft set organization_id = om.organization_id from public.organization_memberships om where om.user_id = ft.user_id and om.role = 'owner' and ft.organization_id is null;
update public.ad_accounts aa set organization_id = om.organization_id from public.organization_memberships om where om.user_id = aa.user_id and om.role = 'owner' and aa.organization_id is null;
create index if not exists facebook_tokens_organization_idx on public.facebook_tokens (organization_id);
create index if not exists ad_accounts_organization_idx on public.ad_accounts (organization_id);

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_deals enable row level security;

create policy "organization members read organizations" on public.organizations for select using (public.can_access_organization(id));
create policy "organization members read memberships" on public.organization_memberships for select using (public.can_access_organization(organization_id));
create policy "organization members manage stages" on public.crm_pipeline_stages for all using (public.can_access_organization(organization_id)) with check (public.can_access_organization(organization_id));
create policy "organization members manage contacts" on public.crm_contacts for all using (public.can_access_organization(organization_id)) with check (public.can_access_organization(organization_id));
create policy "organization members manage leads" on public.crm_leads for all using (public.can_access_organization(organization_id)) with check (public.can_access_organization(organization_id));
create policy "organization members manage deals" on public.crm_deals for all using (public.can_access_organization(organization_id)) with check (public.can_access_organization(organization_id));
```

- [ ] **Step 4: Run migration in Supabase SQL Editor after backup confirmation**

Run: paste `supabase-crm-phase-1.sql` into the active project SQL Editor and execute once.

Expected: tables `organizations`, `organization_memberships`, `crm_contacts`, `crm_pipeline_stages`, `crm_leads` and `crm_deals` exist; every existing user has one owner membership; existing Meta rows have an organization ID.

- [ ] **Step 5: Verify RLS with two non-admin test users**

Run in SQL Editor while using each authenticated user session: `select * from public.crm_leads;`

Expected: each user can read only leads where `organization_id` belongs to that user's membership; a user with no shared membership returns zero rows for another organization.

- [ ] **Step 6: Commit migration**

```bash
git add supabase-crm-phase-1.sql
git commit -m "feat: add multi-tenant CRM schema"
```

### Task 3: Resolve active organization securely

**Files:**
- Create: `lib/organization-access.ts`
- Create: `tests/organization-access.test.ts`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Write failing access-helper tests**

```ts
import { describe, expect, it } from "vitest";
import { pickActiveOrganization } from "../lib/organization-access";

describe("pickActiveOrganization", () => {
  it("uses owner membership before lower organization roles", () => {
    expect(pickActiveOrganization([{ organization_id: "agent", role: "agent" }, { organization_id: "owner", role: "owner" }])).toBe("owner");
  });
  it("returns null when membership list is empty", () => {
    expect(pickActiveOrganization([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- tests/organization-access.test.ts`

Expected: FAIL because `../lib/organization-access` does not exist.

- [ ] **Step 3: Implement pure selection and server lookup**

```ts
import type { OrganizationRole } from "./crm-types";
import { createClient } from "./supabase/server";

type Membership = { organization_id: string; role: OrganizationRole };
const ROLE_ORDER: Record<OrganizationRole, number> = { owner: 0, manager: 1, agent: 2 };

export function pickActiveOrganization(memberships: Membership[]): string | null {
  return [...memberships].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])[0]?.organization_id ?? null;
}

export async function requireActiveOrganization() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, organizationId: null };
  const { data, error } = await supabase.from("organization_memberships").select("organization_id,role").eq("user_id", user.id);
  if (error) throw new Error("Não foi possível carregar organização");
  return { supabase, user, organizationId: pickActiveOrganization((data ?? []) as Membership[]) };
}
```

- [ ] **Step 4: Change dashboard role source**

Replace the dashboard role assignment in `app/dashboard/page.tsx` with:

```ts
import { getPlatformRole } from "@/lib/auth-role";
// keep existing imports
role: getPlatformRole(user),
```

Expected: `Romualdormd@hotmail.com`, which has `app_metadata.role = admin`, receives the admin dashboard UI even though `user_metadata.role` is absent.

- [ ] **Step 5: Run tests, typecheck and commit**

Run: `npm test -- tests/organization-access.test.ts tests/auth-role.test.ts && npm run typecheck`

Expected: PASS and exit code 0.

```bash
git add lib/organization-access.ts tests/organization-access.test.ts app/dashboard/page.tsx
git commit -m "feat: resolve CRM organization access"
```

### Task 4: Create CRM API routes

**Files:**
- Create: `app/api/crm/context/route.ts`
- Create: `app/api/crm/leads/route.ts`
- Create: `app/api/crm/leads/[leadId]/route.ts`

- [ ] **Step 1: Write the context route**

```ts
import { NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/organization-access";

export async function GET() {
  const { supabase, user, organizationId } = await requireActiveOrganization();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!organizationId) return NextResponse.json({ error: "Organização não encontrada" }, { status: 409 });
  const { data, error } = await supabase.from("crm_pipeline_stages").select("id,name,position").eq("organization_id", organizationId).order("position");
  if (error) return NextResponse.json({ error: "Não foi possível carregar etapas" }, { status: 500 });
  return NextResponse.json({ organization_id: organizationId, stages: data });
}
```

- [ ] **Step 2: Write list/create lead route with organization-scoped writes**

```ts
import { NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/organization-access";
import { validateLeadCreate } from "@/lib/crm-validation";

export async function GET() {
  const { supabase, user, organizationId } = await requireActiveOrganization();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!organizationId) return NextResponse.json({ error: "Organização não encontrada" }, { status: 409 });
  const { data, error } = await supabase.from("crm_leads").select("id,contact_id,stage_id,source,status,created_at,crm_contacts(name,phone,email)").eq("organization_id", organizationId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Não foi possível carregar leads" }, { status: 500 });
  const leads = (data ?? []).map(({ crm_contacts, ...lead }) => {
    const contact = Array.isArray(crm_contacts) ? crm_contacts[0] : crm_contacts;
    return { ...lead, contact_name: contact?.name ?? "Sem nome", contact_phone: contact?.phone ?? null, contact_email: contact?.email ?? null };
  });
  return NextResponse.json({ leads });
}

export async function POST(request: Request) {
  const { supabase, user, organizationId } = await requireActiveOrganization();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!organizationId) return NextResponse.json({ error: "Organização não encontrada" }, { status: 409 });
  const parsed = validateLeadCreate(await request.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { source, ...contactValues } = parsed.value;
  const { data: stage } = await supabase.from("crm_pipeline_stages").select("id").eq("organization_id", organizationId).order("position").limit(1).single();
  if (!stage) return NextResponse.json({ error: "Funil não configurado" }, { status: 409 });
  let contactLookup = supabase.from("crm_contacts").select("id").eq("organization_id", organizationId);
  contactLookup = contactValues.phone ? contactLookup.eq("phone", contactValues.phone) : contactLookup.eq("email", contactValues.email!);
  const { data: existingContact, error: lookupError } = await contactLookup.maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Não foi possível procurar contato" }, { status: 500 });
  const contactWrite = existingContact
    ? supabase.from("crm_contacts").update(contactValues).eq("id", existingContact.id).eq("organization_id", organizationId).select("id").single()
    : supabase.from("crm_contacts").insert({ organization_id: organizationId, ...contactValues }).select("id").single();
  const { data: contact, error: contactError } = await contactWrite;
  if (contactError || !contact) return NextResponse.json({ error: "Não foi possível salvar contato" }, { status: 500 });
  const { data: lead, error: leadError } = await supabase.from("crm_leads").insert({ organization_id: organizationId, contact_id: contact.id, stage_id: stage.id, source }).select("id,stage_id,source,status,created_at").single();
  if (leadError) return NextResponse.json({ error: "Não foi possível criar lead" }, { status: 500 });
  return NextResponse.json({ lead }, { status: 201 });
}
```

- [ ] **Step 3: Write stage update route that denies cross-organization IDs**

```ts
import { NextResponse } from "next/server";
import { requireActiveOrganization } from "@/lib/organization-access";
import { validateLeadStageUpdate } from "@/lib/crm-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { supabase, user, organizationId } = await requireActiveOrganization();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!organizationId) return NextResponse.json({ error: "Organização não encontrada" }, { status: 409 });
  const parsed = validateLeadStageUpdate(await request.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { leadId } = await params;
  const { data: stage } = await supabase.from("crm_pipeline_stages").select("id").eq("id", parsed.value.stage_id).eq("organization_id", organizationId).maybeSingle();
  if (!stage) return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  const { data, error } = await supabase.from("crm_leads").update({ stage_id: stage.id }).eq("id", leadId).eq("organization_id", organizationId).select("id,stage_id").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível atualizar lead" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  return NextResponse.json({ lead: data });
}
```

- [ ] **Step 4: Verify route behavior manually with an authenticated session**

Run:

```bash
curl -i https://dashadspro.cloud/api/crm/context
curl -i https://dashadspro.cloud/api/crm/leads
```

Expected without browser session: both return `401`. Expected in an authenticated browser: context returns only caller stages, lead list returns only caller organization records, and a cross-organization lead ID returns `404`.

- [ ] **Step 5: Commit routes**

```bash
git add app/api/crm/context/route.ts app/api/crm/leads/route.ts app/api/crm/leads/[leadId]/route.ts
git commit -m "feat: add organization-scoped CRM API"
```

### Task 5: Build focused CRM user interface and dashboard entry point

**Files:**
- Create: `app/crm/page.tsx`
- Create: `app/crm/CrmClient.tsx`
- Modify: `DashAdsPro.tsx:3562-3570`

- [ ] **Step 1: Create authenticated CRM page boundary**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CrmClient from "./CrmClient";

export default async function CrmPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <CrmClient userName={user.user_metadata?.full_name ?? user.email ?? "Usuário"} />;
}
```

- [ ] **Step 2: Implement complete client component**

Use this complete `app/crm/CrmClient.tsx` implementation:

```tsx
"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { CrmLead, CrmStage, LeadSource } from "@/lib/crm-types";

type FormState = { name: string; phone: string; email: string; source: LeadSource };
const emptyForm: FormState = { name: "", phone: "", email: "", source: "manual" };

export default function CrmClient({ userName }: { userName: string }) {
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [contextResponse, leadsResponse] = await Promise.all([fetch("/api/crm/context"), fetch("/api/crm/leads")]);
    if (!contextResponse.ok || !leadsResponse.ok) throw new Error("Não foi possível carregar CRM");
    setStages((await contextResponse.json()).stages);
    setLeads((await leadsResponse.json()).leads);
  }, []);

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar CRM"))
      .finally(() => setLoading(false));
  }, [load]);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      const response = await fetch("/api/crm/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível criar lead");
      setForm(emptyForm); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar lead"); }
    finally { setSaving(false); }
  }

  async function moveLead(leadId: string, stageId: string) {
    setError(null);
    try {
      const response = await fetch(`/api/crm/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage_id: stageId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível mover lead");
      setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, stage_id: stageId } : lead));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível mover lead"); }
  }

  return <main className="min-h-screen bg-[#050505] text-white p-4 sm:p-6 space-y-6">
    <header className="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <div><p className="text-[#39FF14] text-xs font-mono">CRM</p><h1 className="text-2xl font-bold">Leads de {userName}</h1></div>
      <Link href="/dashboard" className="text-sm text-gray-300 border border-[#2a2a2a] rounded-lg px-3 py-2 hover:border-[#39FF14]">Dashboard</Link>
    </header>
    <section className="max-w-7xl mx-auto bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
      <form onSubmit={createLead} className="grid gap-3 sm:grid-cols-5">
        <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome" className="bg-[#111] border border-[#222] rounded-lg px-3 py-2" />
        <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="WhatsApp" className="bg-[#111] border border-[#222] rounded-lg px-3 py-2" />
        <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="E-mail" className="bg-[#111] border border-[#222] rounded-lg px-3 py-2" />
        <select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as LeadSource })} className="bg-[#111] border border-[#222] rounded-lg px-3 py-2"><option value="manual">Manual</option><option value="whatsapp">WhatsApp</option><option value="landing_page">Landing page</option></select>
        <button disabled={saving} className="bg-[#39FF14] text-black font-bold rounded-lg px-3 py-2 disabled:opacity-50">{saving ? "Salvando..." : "Novo lead"}</button>
      </form>
      {error && <p role="alert" className="text-rose-400 text-sm mt-3">{error}</p>}
    </section>
    {loading ? <p className="max-w-7xl mx-auto text-gray-500">Carregando CRM...</p> : <section className="max-w-7xl mx-auto grid gap-4 xl:grid-cols-6 overflow-x-auto">
      {stages.map((stage) => <div key={stage.id} className="min-w-64 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 space-y-3">
        <h2 className="font-semibold text-sm">{stage.name}</h2>
        {leads.filter((lead) => lead.stage_id === stage.id).map((lead) => <article key={lead.id} className="bg-[#111] border border-[#222] rounded-lg p-3 space-y-2">
          <p className="font-medium">{lead.contact_name}</p><p className="text-xs text-gray-400">{lead.contact_phone ?? lead.contact_email}</p>
          <select aria-label={`Mover ${lead.contact_name}`} value={lead.stage_id} onChange={(event) => moveLead(lead.id, event.target.value)} className="w-full bg-[#050505] border border-[#333] rounded px-2 py-1 text-xs">{stages.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
        </article>)}
      </div>)}
    </section>}
  </main>;
}
```

`CrmClient.tsx` must contain these data requests and safe state transitions:

```ts
const [stages, setStages] = useState<CrmStage[]>([]);
const [leads, setLeads] = useState<CrmLead[]>([]);
const [error, setError] = useState<string | null>(null);

const load = useCallback(async () => {
  const [contextResponse, leadsResponse] = await Promise.all([fetch("/api/crm/context"), fetch("/api/crm/leads")]);
  if (!contextResponse.ok || !leadsResponse.ok) throw new Error("Não foi possível carregar CRM");
  setStages((await contextResponse.json()).stages);
  setLeads((await leadsResponse.json()).leads);
}, []);

async function moveLead(leadId: string, stageId: string) {
  const response = await fetch(`/api/crm/leads/${leadId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage_id: stageId }) });
  if (!response.ok) throw new Error((await response.json()).error ?? "Não foi possível mover lead");
  setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, stage_id: stageId } : lead));
}
```

Render columns from `stages`, lead cards grouped by `stage_id`, a manual lead form with name, phone, email and source, visible loading and error states, and links back to `/dashboard`. Do not copy the large dashboard into this component.

- [ ] **Step 3: Add CRM link beside existing Admin link**

At `DashAdsPro.tsx` near the existing `/admin` anchor, add:

```tsx
<a href="/crm" title="CRM" className="p-2 rounded-lg text-gray-400 hover:text-[#39FF14] hover:bg-[#39FF14]/10 transition-colors">
  <Users size={16} />
</a>
```

The icon is already imported in `DashAdsPro.tsx`; preserve the existing admin visibility rule and logout behavior.

- [ ] **Step 4: Verify browser workflow**

Run: `npm run dev`

Expected workflow: sign in, open `/crm`, create a manual WhatsApp lead, see it in `Novo lead`, move it to `Em atendimento`, refresh page and see it persist. Open `/dashboard` and use the CRM link. A different organization must not see the lead.

- [ ] **Step 5: Commit UI**

```bash
git add app/crm/page.tsx app/crm/CrmClient.tsx DashAdsPro.tsx
git commit -m "feat: add CRM pipeline interface"
```

### Task 6: Full verification, database confirmation and deployment

**Files:**
- Modify only files corrected by verification failures.

- [ ] **Step 1: Run all automated checks**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Expected: test suite passes, typecheck exits 0, lint has no errors, build succeeds.

- [ ] **Step 2: Perform production smoke test after deployment**

Run:

```bash
curl -I https://dashadspro.cloud/login
curl -I https://dashadspro.cloud/crm
curl -I https://dashadspro.cloud/api/crm/context
```

Expected: login is `200`, CRM redirects unauthenticated visitors to login, API context returns `401` unauthenticated.

- [ ] **Step 3: Check tenant isolation in Supabase Table Editor**

Verify `crm_leads` contains an `organization_id` for every row and that its `organization_id` matches the related contact and stage. Verify that `organization_memberships` has no duplicate `(organization_id, user_id)` rows.

- [ ] **Step 4: Commit final verification corrections and deploy**

```bash
git add -A
git commit -m "fix: verify CRM tenant isolation"
git push origin main
```

Do not create this final commit if no verification correction exists. Push the already-created commits instead.

## Plan self-review

- Spec coverage: Phase 1 requirements map to Tasks 1-5. Database isolation and global-admin compatibility map to Tasks 2-3. CRM access, lead flow and UI map to Tasks 4-5. Verification maps to Task 6.
- Deferred by design: landing pages, Kie.ai, custom domains, `.zip` export, Z-API messaging and revenue attribution require the Phase 1 organization boundary and will receive separate implementation plans.
- Placeholder scan: no incomplete markers or implied test steps remain.
- Type consistency: `OrganizationRole`, `LeadSource`, `CrmStage` and `CrmLead` are declared in Task 1 and used consistently by Tasks 3-5.
