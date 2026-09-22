import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOrganizationFeature } = vi.hoisted(() => ({
  requireOrganizationFeature: vi.fn(),
}));

vi.mock("../lib/feature-access", () => ({ requireOrganizationFeature }));

import { GET as getContext } from "../app/api/crm/context/route";
import { GET as getLeads, POST as createLead } from "../app/api/crm/leads/route";
import { PATCH as updateLead } from "../app/api/crm/leads/[leadId]/route";

const organizationId = "550e8400-e29b-41d4-a716-446655440000";
const leadId = "550e8400-e29b-41d4-a716-446655440001";
const stageId = "550e8400-e29b-41d4-a716-446655440002";

function activeAccess(supabase: object = {}) {
  return {
    supabase,
    user: {
      id: "user-1",
      email: "maria@example.com",
      user_metadata: { full_name: "Maria Silva", avatar_url: "https://example.com/maria.png" },
    },
    organizationId,
  };
}

function query(result: unknown) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  for (const method of Object.values(builder)) method.mockReturnValue(builder);
  Object.assign(builder, {
    then: <T>(onfulfilled?: (value: unknown) => T | PromiseLike<T>) =>
      Promise.resolve(result).then(onfulfilled),
  });
  return builder;
}

describe("CRM API routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 from CRM context without authenticated user", async () => {
    requireOrganizationFeature.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });

    const response = await getContext(new Request("http://localhost/api/crm/context"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 409 from CRM context when user has no organization membership", async () => {
    requireOrganizationFeature.mockResolvedValue({
      ok: false,
      status: 409,
      error: "Organization membership required",
    });

    const response = await getContext(new Request("http://localhost/api/crm/context"));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Organization membership required" });
  });

  it("hydrates CRM context with organization, membership, ordered stages, and current user", async () => {
    const membership = query({ data: { organization_id: organizationId, role: "owner" }, error: null });
    const organization = query({ data: { id: organizationId, name: "Acme", slug: "acme" }, error: null });
    const stages = query({
      data: [{ id: stageId, name: "Novo lead", position: 1 }],
      error: null,
    });
    const supabase = {
      from: vi.fn((table: string) => ({
        organization_memberships: membership,
        organizations: organization,
        crm_pipeline_stages: stages,
      })[table]),
    };
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess(supabase) });

    const response = await getContext(new Request("http://localhost/api/crm/context"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organization: { id: organizationId, name: "Acme", slug: "acme" },
      membership: { organizationId, role: "owner" },
      stages: [{ id: stageId, name: "Novo lead", position: 1 }],
      organizations: [],
      user: {
        id: "user-1",
        email: "maria@example.com",
        name: "Maria Silva",
        avatarUrl: "https://example.com/maria.png",
      },
    });
    expect(stages.order).toHaveBeenCalledWith("position", { ascending: true });
  });

  it("returns RLS-visible organization choices only for a platform admin", async () => {
    const membership = query({ data: null, error: null });
    const activeOrganization = query({ data: { id: organizationId, name: "Acme", slug: "acme" }, error: null });
    const stages = query({ data: [], error: null });
    const organizations = query({
      data: [
        { id: organizationId, name: "Acme" },
        { id: "550e8400-e29b-41d4-a716-446655440010", name: "Beta" },
      ],
      error: null,
    });
    let organizationQueries = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "organization_memberships") return membership;
        if (table === "crm_pipeline_stages") return stages;
        if (table === "organizations") {
          organizationQueries += 1;
          return organizationQueries === 1 ? activeOrganization : organizations;
        }
        return undefined;
      }),
    };
    requireOrganizationFeature.mockResolvedValue({
      ok: true,
      ...activeAccess(supabase),
      user: { id: "admin-1", app_metadata: { role: "admin" } },
    });

    const response = await getContext(new Request(`http://localhost/api/crm/context?organization_id=${organizationId}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      membership: { organizationId, role: "admin" },
      organizations: [
        { id: organizationId, name: "Acme" },
        { id: "550e8400-e29b-41d4-a716-446655440010", name: "Beta" },
      ],
    });
    expect(organizations.order).toHaveBeenCalledWith("name", { ascending: true });
  });

  it("forwards organization selection from CRM route query parameters", async () => {
    const from = vi.fn();
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess({ from }) });
    const requestedOrganizationId = "550e8400-e29b-41d4-a716-446655440010";

    await getLeads(new Request(`http://localhost/api/crm/leads?organization_id=${requestedOrganizationId}`));
    await createLead(new Request(`http://localhost/api/crm/leads?organization_id=${requestedOrganizationId}`, {
      method: "POST",
      body: JSON.stringify({ name: "Maria Silva", email: "maria@example.com", source: "manual" }),
    }));
    await updateLead(
      new Request(`http://localhost/api/crm/leads/${leadId}?organization_id=${requestedOrganizationId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage_id: stageId }),
      }),
      { params: Promise.resolve({ leadId }) },
    );

    expect(requireOrganizationFeature).toHaveBeenNthCalledWith(1, "crm", requestedOrganizationId);
    expect(requireOrganizationFeature).toHaveBeenNthCalledWith(2, "crm", requestedOrganizationId);
    expect(requireOrganizationFeature).toHaveBeenNthCalledWith(3, "crm", requestedOrganizationId);
  });

  it("returns organization-scoped CRM leads with contact and stage data", async () => {
    const leads = query({
      data: [{
        id: leadId,
        contact_id: "contact-1",
        stage_id: stageId,
        source: "manual",
        status: "open",
        created_at: "2026-09-21T00:00:00.000Z",
        updated_at: "2026-09-21T00:00:00.000Z",
        contact: { name: "Maria Silva", phone: "5511988887777", email: null },
        stage: { id: stageId, name: "Novo lead", position: 1 },
      }],
      error: null,
    });
    const supabase = { from: vi.fn(() => leads) };
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess(supabase) });

    const response = await getLeads(new Request("http://localhost/api/crm/leads"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      leads: [{
        id: leadId,
        contact_id: "contact-1",
        stage_id: stageId,
        source: "manual",
        status: "open",
        created_at: "2026-09-21T00:00:00.000Z",
        updated_at: "2026-09-21T00:00:00.000Z",
        contact_name: "Maria Silva",
        contact_phone: "5511988887777",
        contact_email: null,
      }],
    });
    expect(leads.eq).toHaveBeenCalledWith("organization_id", organizationId);
  });

  it("creates CRM contact and lead through organization-scoped atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ lead_id: leadId, contact_id: "contact-1", stage_id: stageId }],
      error: null,
    });
    const supabase = { rpc };
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess(supabase) });

    const response = await createLead(new Request("http://localhost/api/crm/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Maria Silva", phone: "(11) 98888-7777", source: "manual" }),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      lead: { id: leadId, contact_id: "contact-1", stage_id: stageId },
    });
    expect(rpc).toHaveBeenCalledWith("create_crm_lead", {
      target_organization_id: organizationId,
      contact_name: "Maria Silva",
      contact_phone: "5511988887777",
      contact_email: null,
      lead_source: "manual",
    });
  });

  it("uses atomic organization-scoped lead RPC so a lead failure cannot mutate a contact", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23503" } });
    const from = vi.fn();
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess({ rpc, from }) });

    const response = await createLead(new Request("http://localhost/api/crm/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Maria Silva",
        phone: "(11) 98888-7777",
        email: "  Maria@Example.COM ",
        source: "manual",
      }),
    }));

    expect(response.status).toBe(500);
    expect(rpc).toHaveBeenCalledWith("create_crm_lead", {
      target_organization_id: organizationId,
      contact_name: "Maria Silva",
      contact_phone: "5511988887777",
      contact_email: "maria@example.com",
      lead_source: "manual",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects invalid CRM lead input before writing", async () => {
    const from = vi.fn();
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess({ from }) });

    const response = await createLead(new Request("http://localhost/api/crm/leads", {
      method: "POST",
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Parametros invalidos" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns conflict when organization has no pipeline stages", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "P0001", message: "Pipeline stage required" } });
    const supabase = { rpc };
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess(supabase) });

    const response = await createLead(new Request("http://localhost/api/crm/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Maria Silva", email: "maria@example.com", source: "manual" }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Pipeline stage required" });
  });

  it("returns 409 when atomic contact resolution finds conflicting identities", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23505" } });
    const supabase = { rpc };
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess(supabase) });

    const response = await createLead(new Request("http://localhost/api/crm/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Maria Silva",
        phone: "(11) 98888-7777",
        email: "maria@example.com",
        source: "manual",
      }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Contact identities conflict" });
  });

  it("does not update leads when route ID is not a UUID", async () => {
    const from = vi.fn();
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess({ from }) });

    const response = await updateLead(
      new Request("http://localhost/api/crm/leads/not-a-uuid", {
        method: "PATCH",
        body: JSON.stringify({ stage_id: stageId, updated_at: "2026-09-22T12:00:00.000Z" }),
      }),
      { params: Promise.resolve({ leadId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Lead invalido" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates lead only after destination stage is found inside current organization", async () => {
    const destinationStage = query({ data: { id: stageId }, error: null });
    const snapshotUpdatedAt = "2026-09-22T12:00:00.000Z";
    const updatedLead = query({ data: { id: leadId, stage_id: stageId, updated_at: "2026-09-22T12:00:01.000Z" }, error: null });
    const supabase = {
      from: vi.fn((table: string) => ({
        crm_pipeline_stages: destinationStage,
        crm_leads: updatedLead,
      })[table]),
    };
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess(supabase) });

    const response = await updateLead(
      new Request(`http://localhost/api/crm/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage_id: stageId, updated_at: snapshotUpdatedAt }),
      }),
      { params: Promise.resolve({ leadId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ lead: { id: leadId, stage_id: stageId, updated_at: "2026-09-22T12:00:01.000Z" } });
    expect(destinationStage.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(updatedLead.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(updatedLead.eq).toHaveBeenCalledWith("updated_at", snapshotUpdatedAt);
  });

  it("returns 409 when lead changed after client snapshot", async () => {
    const snapshotUpdatedAt = "2026-09-22T12:00:00.000Z";
    const destinationStage = query({ data: { id: stageId }, error: null });
    const staleLead = query({ data: null, error: null });
    const existingLead = query({ data: { id: leadId }, error: null });
    let leadQueries = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "crm_pipeline_stages") return destinationStage;
        if (table === "crm_leads") return [staleLead, existingLead][leadQueries++];
        return undefined;
      }),
    };
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess(supabase) });

    const response = await updateLead(
      new Request(`http://localhost/api/crm/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage_id: stageId, updated_at: snapshotUpdatedAt }),
      }),
      { params: Promise.resolve({ leadId }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Lead changed; reload and try again" });
    expect(staleLead.eq).toHaveBeenCalledWith("updated_at", snapshotUpdatedAt);
  });

  it("keeps 404 when lead does not exist", async () => {
    const destinationStage = query({ data: { id: stageId }, error: null });
    const staleLead = query({ data: null, error: null });
    const missingLead = query({ data: null, error: null });
    let leadQueries = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "crm_pipeline_stages") return destinationStage;
        if (table === "crm_leads") return [staleLead, missingLead][leadQueries++];
        return undefined;
      }),
    };
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess(supabase) });

    const response = await updateLead(
      new Request(`http://localhost/api/crm/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage_id: stageId, updated_at: "2026-09-22T12:00:00.000Z" }),
      }),
      { params: Promise.resolve({ leadId }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Lead not found" });
  });

  it("does not update a lead when destination stage is outside current organization", async () => {
    const destinationStage = query({ data: null, error: null });
    const from = vi.fn(() => destinationStage);
    requireOrganizationFeature.mockResolvedValue({ ok: true, ...activeAccess({ from }) });

    const response = await updateLead(
      new Request(`http://localhost/api/crm/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage_id: stageId, updated_at: "2026-09-22T12:00:00.000Z" }),
      }),
      { params: Promise.resolve({ leadId }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Stage not found" });
    expect(from).toHaveBeenCalledTimes(1);
  });
});
