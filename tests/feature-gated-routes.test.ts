import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireActiveOrganization,
  requireOrganizationFeature,
  createClient,
  getFacebookToken,
  fetchAdAccountInsights,
  fetchAdInsights,
  getPreviousPeriod,
  parseDateSelection,
} = vi.hoisted(() => ({
  requireActiveOrganization: vi.fn(),
  requireOrganizationFeature: vi.fn(),
  createClient: vi.fn(),
  getFacebookToken: vi.fn(),
  fetchAdAccountInsights: vi.fn(),
  fetchAdInsights: vi.fn(),
  getPreviousPeriod: vi.fn(),
  parseDateSelection: vi.fn(),
}));

vi.mock("../lib/organization-access", () => ({ requireActiveOrganization }));
vi.mock("../lib/feature-access", () => ({ requireOrganizationFeature }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/meta-token", () => ({ getFacebookToken }));
vi.mock("@/lib/meta-validation", () => ({ getPreviousPeriod, parseDateSelection }));
vi.mock("@/lib/meta-api", () => ({
  fetchAdAccountInsights,
  fetchAdInsights,
  fetchAdAccountInsightsDaily: vi.fn(),
  fetchPlatformBreakdown: vi.fn(),
  fetchVideoRetention: vi.fn(),
  fetchFunnelActions: vi.fn(),
}));

import { GET as getCrmLeads } from "../app/api/crm/leads/route";
import { GET as getMetaAds } from "../app/api/meta/ads/route";
import { GET as getMetaInsights } from "../app/api/meta/insights/route";

const organizationId = "550e8400-e29b-41d4-a716-446655440000";

describe("feature-gated product routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("denies CRM leads before CRM data query when CRM access is absent", async () => {
    const from = vi.fn();
    requireActiveOrganization.mockResolvedValue({
      supabase: { from },
      user: { id: "user-1" },
      organizationId,
    });
    requireOrganizationFeature.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Feature access required",
    });

    const response = await getCrmLeads(
      new Request(`http://localhost/api/crm/leads?organization_id=${organizationId}`),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Feature access required" });
    expect(requireOrganizationFeature).toHaveBeenCalledWith("crm", organizationId);
    expect(from).not.toHaveBeenCalled();
  });

  it("denies Meta insights before Meta data query when dashboard access is absent", async () => {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { user_metadata: { selected_ad_account_id: "act_123" } } } }) },
    });
    getFacebookToken.mockResolvedValue({ token: "token" });
    requireOrganizationFeature.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Feature access required",
    });

    const response = await getMetaInsights(
      new Request(`http://localhost/api/meta/insights?organization_id=${organizationId}`),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Feature access required" });
    expect(requireOrganizationFeature).toHaveBeenCalledWith("dashboard_ads", organizationId);
    expect(fetchAdAccountInsights).not.toHaveBeenCalled();
  });

  it("uses gated Meta user when loading a Facebook token", async () => {
    const user = { id: "user-1", user_metadata: { selected_ad_account_id: "act_123" } };
    requireOrganizationFeature.mockResolvedValue({ ok: true, supabase: {}, user, organizationId });
    getFacebookToken.mockResolvedValue({ token: "token" });
    fetchAdInsights.mockResolvedValue([]);

    const response = await getMetaAds(new Request("http://localhost/api/meta/ads"));

    expect(response.status).toBe(200);
    expect(getFacebookToken).toHaveBeenCalledWith(user);
  });
});
