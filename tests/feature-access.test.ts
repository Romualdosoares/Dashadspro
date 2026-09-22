import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireActiveOrganization } = vi.hoisted(() => ({
  requireActiveOrganization: vi.fn(),
}));

vi.mock("../lib/organization-access", () => ({ requireActiveOrganization }));

import {
  listOrganizationFeatureKeys,
  requireOrganizationFeature,
} from "../lib/feature-access";

describe("requireOrganizationFeature", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 before querying access for an unauthenticated request", async () => {
    const from = vi.fn();
    requireActiveOrganization.mockResolvedValue({
      supabase: { from },
      user: null,
      organizationId: null,
    });

    await expect(requireOrganizationFeature("crm")).resolves.toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 409 when authenticated user has no active organization", async () => {
    const from = vi.fn();
    requireActiveOrganization.mockResolvedValue({
      supabase: { from },
      user: { id: "user-1" },
      organizationId: null,
    });

    await expect(requireOrganizationFeature("crm")).resolves.toEqual({
      ok: false,
      status: 409,
      error: "Organization membership required",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns 403 when active organization has no feature grant", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const statusEq = vi.fn(() => ({ maybeSingle }));
    const keyEq = vi.fn(() => ({ eq: statusEq }));
    const organizationEq = vi.fn(() => ({ eq: keyEq }));
    const select = vi.fn(() => ({ eq: organizationEq }));
    const from = vi.fn(() => ({ select }));
    requireActiveOrganization.mockResolvedValue({
      supabase: { from },
      user: { id: "user-1" },
      organizationId: "organization-1",
    });

    await expect(requireOrganizationFeature("crm")).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Feature access required",
    });
    expect(from).toHaveBeenCalledWith("organization_feature_accesses");
    expect(select).toHaveBeenCalledWith("feature:product_features!inner(key, status)");
    expect(organizationEq).toHaveBeenCalledWith("organization_id", "organization-1");
    expect(keyEq).toHaveBeenCalledWith("feature.key", "crm");
    expect(statusEq).toHaveBeenCalledWith("feature.status", "active");
  });

  it("returns success for an active crm grant", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { feature: { key: "crm", status: "active" } },
      error: null,
    });
    const statusEq = vi.fn(() => ({ maybeSingle }));
    const keyEq = vi.fn(() => ({ eq: statusEq }));
    const organizationEq = vi.fn(() => ({ eq: keyEq }));
    const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: organizationEq })) }));
    const supabase = { from };
    const user = { id: "user-1" };
    requireActiveOrganization.mockResolvedValue({
      supabase,
      user,
      organizationId: "organization-1",
    });

    await expect(requireOrganizationFeature("crm")).resolves.toEqual({
      ok: true,
      supabase,
      user,
      organizationId: "organization-1",
    });
  });

  it("throws readable error when access query fails", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("database unavailable"),
    });
    const statusEq = vi.fn(() => ({ maybeSingle }));
    const keyEq = vi.fn(() => ({ eq: statusEq }));
    const organizationEq = vi.fn(() => ({ eq: keyEq }));
    const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: organizationEq })) }));
    requireActiveOrganization.mockResolvedValue({
      supabase: { from },
      user: { id: "user-1" },
      organizationId: "organization-1",
    });

    await expect(requireOrganizationFeature("crm")).rejects.toThrow(
      "Could not load feature access: database unavailable",
    );
  });
});

describe("listOrganizationFeatureKeys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns no keys before querying access for an unauthenticated request", async () => {
    const from = vi.fn();
    requireActiveOrganization.mockResolvedValue({
      supabase: { from },
      user: null,
      organizationId: null,
    });

    await expect(listOrganizationFeatureKeys()).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns no keys when authenticated user has no active organization", async () => {
    const from = vi.fn();
    requireActiveOrganization.mockResolvedValue({
      supabase: { from },
      user: { id: "user-1" },
      organizationId: null,
    });

    await expect(listOrganizationFeatureKeys()).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns only valid active feature keys", async () => {
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            { feature: { key: "crm", status: "active" } },
            { feature: { key: "retired_feature", status: "active" } },
            { feature: { key: "site_builder", status: "archived" } },
          ],
          error: null,
        }),
      })),
    }));
    const from = vi.fn(() => ({ select }));
    requireActiveOrganization.mockResolvedValue({
      supabase: { from },
      user: { id: "user-1" },
      organizationId: "organization-1",
    });

    await expect(listOrganizationFeatureKeys()).resolves.toEqual(["crm"]);
    expect(from).toHaveBeenCalledWith("organization_feature_accesses");
    expect(select).toHaveBeenCalledWith("feature:product_features!inner(key, status)");
  });
});
