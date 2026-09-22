import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdmin,
  createAdminClient,
  requireActiveOrganization,
  listOrganizationFeatureKeys,
} = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  requireActiveOrganization: vi.fn(),
  listOrganizationFeatureKeys: vi.fn(),
}));

vi.mock("../lib/admin-guard", () => ({ requireAdmin }));
vi.mock("../lib/supabase/server", () => ({ createAdminClient }));
vi.mock("../lib/organization-access", () => ({ requireActiveOrganization }));
vi.mock("../lib/feature-access", () => ({ listOrganizationFeatureKeys }));

import {
  GET as getFeatures,
  PATCH as patchFeature,
  POST as createFeature,
} from "../app/api/admin/features/route";
import { GET as getOrganizations } from "../app/api/admin/organizations/route";
import {
  GET as getOrganizationFeatures,
  PUT as replaceOrganizationFeatures,
} from "../app/api/admin/organizations/[organizationId]/features/route";
import { GET as getFeatureContext } from "../app/api/features/context/route";

const organizationId = "550e8400-e29b-41d4-a716-446655440000";
const otherOrganizationId = "550e8400-e29b-41d4-a716-446655440001";

function query(result: unknown) {
  const builder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  };
  for (const method of Object.values(builder)) method.mockReturnValue(builder);
  Object.assign(builder, {
    then: <T>(onfulfilled?: (value: unknown) => T | PromiseLike<T>) =>
      Promise.resolve(result).then(onfulfilled),
  });
  return builder;
}

function adminAccess() {
  requireAdmin.mockResolvedValue({ user: { id: "admin-1" }, response: null });
}

describe("admin feature management routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns requireAdmin 401 without querying catalog", async () => {
    const from = vi.fn();
    requireAdmin.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    });
    createAdminClient.mockReturnValue({ from });

    const response = await getFeatures();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns requireAdmin 403 before organization writes", async () => {
    const from = vi.fn();
    requireAdmin.mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    });
    createAdminClient.mockReturnValue({ from });

    const response = await replaceOrganizationFeatures(
      new Request(`http://localhost/api/admin/organizations/${organizationId}/features`, {
        method: "PUT",
        body: JSON.stringify({ featureKeys: ["crm"] }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects unsupported catalog keys and ignores arbitrary route and icon fields", async () => {
    adminAccess();
    const from = vi.fn();
    createAdminClient.mockReturnValue({ from });

    const rejected = await createFeature(new Request("http://localhost/api/admin/features", {
      method: "POST",
      body: JSON.stringify({ key: "billing", name: "Billing", description: "Pay", position: 1 }),
    }));
    const created = query({
      data: { id: "feature-1", key: "crm", name: "CRM", description: "Sales", position: 2, status: "active" },
      error: null,
    });
    createAdminClient.mockReturnValue({ from: vi.fn(() => created) });
    const accepted = await createFeature(new Request("http://localhost/api/admin/features", {
      method: "POST",
      body: JSON.stringify({
        key: "crm",
        name: " CRM ",
        description: " Sales ",
        position: 2,
        route: "/evil",
        icon: "Skull",
      }),
    }));

    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toEqual({ error: "Feature não suportada" });
    expect(from).not.toHaveBeenCalled();
    expect(accepted.status).toBe(201);
    expect(created.insert).toHaveBeenCalledWith({
      key: "crm",
      name: "CRM",
      description: "Sales",
      position: 2,
    });
  });

  it("archives catalog features with PATCH without accepting untrusted fields", async () => {
    adminAccess();
    const updated = query({
      data: { key: "crm", status: "archived" },
      error: null,
    });
    createAdminClient.mockReturnValue({ from: vi.fn(() => updated) });

    const response = await patchFeature(new Request("http://localhost/api/admin/features", {
      method: "PATCH",
      body: JSON.stringify({
        key: "crm",
        name: "CRM",
        description: "Sales",
        position: 2,
        status: "archived",
        route: "/evil",
      }),
    }));

    expect(response.status).toBe(200);
    expect(updated.update).toHaveBeenCalledWith({
      key: "crm",
      name: "CRM",
      description: "Sales",
      position: 2,
      status: "archived",
    });
    expect(updated.eq).toHaveBeenCalledWith("key", "crm");
  });

  it("lists organizations with membership counts from admin-scoped query", async () => {
    adminAccess();
    const organizations = query({
      data: [{
        id: organizationId,
        name: "Acme",
        slug: "acme",
        organization_memberships: [{ count: 3 }],
      }],
      error: null,
    });
    createAdminClient.mockReturnValue({ from: vi.fn(() => organizations) });

    const response = await getOrganizations();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organizations: [{ id: organizationId, name: "Acme", slug: "acme", memberCount: 3 }],
    });
    expect(organizations.select).toHaveBeenCalledWith("id, name, slug, organization_memberships(count)");
  });

  it("returns full catalog and enabled keys scoped to requested organization", async () => {
    adminAccess();
    const catalog = query({ data: [{ key: "crm", status: "active" }], error: null });
    const grants = query({ data: [{ feature: { key: "crm" } }], error: null });
    createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "product_features" ? catalog : grants),
    });

    const response = await getOrganizationFeatures(
      new Request(`http://localhost/api/admin/organizations/${organizationId}/features`),
      { params: Promise.resolve({ organizationId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      features: [{ key: "crm", status: "active" }],
      enabledFeatureKeys: ["crm"],
    });
    expect(grants.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(grants.eq).not.toHaveBeenCalledWith("organization_id", otherOrganizationId);
  });

  it("replaces only target organization feature assignments", async () => {
    adminAccess();
    const catalog = query({
      data: [{ id: "feature-crm", key: "crm" }, { id: "feature-sites", key: "site_builder" }],
      error: null,
    });
    const deletes = query({ data: null, error: null });
    createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => ({
        product_features: catalog,
        organization_feature_accesses: deletes,
      })[table]),
    });

    const response = await replaceOrganizationFeatures(
      new Request(`http://localhost/api/admin/organizations/${organizationId}/features`, {
        method: "PUT",
        body: JSON.stringify({ featureKeys: ["crm", "site_builder"] }),
      }),
      { params: Promise.resolve({ organizationId }) },
    );

    expect(response.status).toBe(200);
    expect(deletes.delete).toHaveBeenCalledOnce();
    expect(deletes.eq).toHaveBeenCalledWith("organization_id", organizationId);
    expect(deletes.eq).not.toHaveBeenCalledWith("organization_id", otherOrganizationId);
    expect(deletes.insert).toHaveBeenCalledWith([
      { organization_id: organizationId, feature_id: "feature-crm" },
      { organization_id: organizationId, feature_id: "feature-sites" },
    ]);
  });

  it("rejects invalid, duplicate, and unknown replacement keys before deletion", async () => {
    adminAccess();
    const from = vi.fn();
    createAdminClient.mockReturnValue({ from });

    for (const featureKeys of ["crm", ["crm", "crm"], ["crm", "billing"]]) {
      const response = await replaceOrganizationFeatures(
        new Request(`http://localhost/api/admin/organizations/${organizationId}/features`, {
          method: "PUT",
          body: JSON.stringify({ featureKeys }),
        }),
        { params: Promise.resolve({ organizationId }) },
      );
      expect(response.status).toBe(400);
    }

    expect(from).not.toHaveBeenCalled();
  });

  it("returns only active assigned client navigation for active organization", async () => {
    requireActiveOrganization.mockResolvedValue({
      supabase: { from: vi.fn() },
      user: { id: "user-1" },
      organizationId,
    });
    listOrganizationFeatureKeys.mockResolvedValue(["crm", "site_builder"]);

    const response = await getFeatureContext(new Request("http://localhost/api/features/context"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organizationId,
      features: [
        { key: "crm", href: "/crm", label: "CRM", icon: "UsersRound" },
        { key: "site_builder", href: "/sites", label: "Criador de Sites", icon: "PanelsTopLeft" },
      ],
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns active organization authentication and membership errors", async () => {
    requireActiveOrganization.mockResolvedValueOnce({ supabase: {}, user: null, organizationId: null });
    const unauthenticated = await getFeatureContext(new Request("http://localhost/api/features/context"));
    requireActiveOrganization.mockResolvedValueOnce({ supabase: {}, user: { id: "user-1" }, organizationId: null });
    const noMembership = await getFeatureContext(new Request("http://localhost/api/features/context"));

    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({ error: "Unauthorized" });
    expect(noMembership.status).toBe(409);
    expect(await noMembership.json()).toEqual({ error: "Organization membership required" });
    expect(listOrganizationFeatureKeys).not.toHaveBeenCalled();
  });
});
