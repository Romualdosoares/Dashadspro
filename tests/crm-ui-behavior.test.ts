import { describe, expect, it, vi } from "vitest";
import { getCrmPageState } from "../lib/crm-page-state";
import {
  PipelineRequestTracker,
  addMovingLead,
  canSubmitCrmLead,
  getMoveLeadAriaLabel,
  isLeadFormDisabled,
  isOrganizationSelectorDisabled,
  emptyLeadForm,
  getCrmPipelineViewLabels,
  loadCrmPipeline,
  removeMovingLead,
  requestLeadMove,
  shouldApplyPipelineResponse,
  shouldShowOrganizationSelector,
  submitCrmLead,
} from "../lib/crm-client-state";
import { getDashboardHeaderActions } from "../lib/dashboard-header-actions";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const stages = [{ id: "stage-new", name: "Novo", position: 1 }];
const lead = {
  id: "lead-1",
  contact_id: "contact-1",
  stage_id: "stage-new",
  source: "manual" as const,
  status: "open" as const,
  contact_name: "Ana Souza",
  contact_phone: null,
  contact_email: "ana@example.com",
  created_at: "2026-09-21T10:00:00.000Z",
  updated_at: "2026-09-21T10:00:00.000Z",
};

describe("CRM page auth state", () => {
  it("redirects an unauthenticated CRM visitor to login", () => {
    expect(getCrmPageState(null)).toEqual({ kind: "redirect", href: "/login" });
  });

  it("uses a safe profile value for authenticated CRM visitors", () => {
    expect(getCrmPageState({ email: "ana@example.com", user_metadata: { name: "Ana" } })).toEqual({
      kind: "content",
      userName: "Ana",
      userEmail: "ana@example.com",
    });
  });
});

describe("CRM client requests", () => {
  it("loads context and leads from their CRM endpoints", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ organization_id: "org-1", stages }))
      .mockResolvedValueOnce(jsonResponse({ leads: [lead] }));

    await expect(loadCrmPipeline(fetcher)).resolves.toEqual({ stages, leads: [lead], organizations: [], organizationId: null });
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/crm/context");
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/crm/leads");
  });

  it("applies selected organization only in CRM endpoint URLs", async () => {
    const organizationId = "550e8400-e29b-41d4-a716-446655440000";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ stages }))
      .mockResolvedValueOnce(jsonResponse({ leads: [lead] }));

    await loadCrmPipeline(fetcher, organizationId);

    expect(fetcher).toHaveBeenNthCalledWith(1, `/api/crm/context?organization_id=${organizationId}`);
    expect(fetcher).toHaveBeenNthCalledWith(2, `/api/crm/leads?organization_id=${organizationId}`);
  });

  it("resets form then reloads canonical leads after creation without synthesizing a lead", async () => {
    const events: string[] = [];
    const fetcher = vi.fn(async () => {
      events.push("request");
      return {
        ok: true,
        json: async () => {
          events.push("response");
          return { lead: { id: "lead-2", contact_id: "contact-2", stage_id: "stage-new" } };
        },
      } as Response;
    });
    const form = { name: "Bruno Lima", phone: "(11) 99999-0000", email: "", source: "whatsapp" as const };

    await submitCrmLead(fetcher, form, (resetForm) => {
      events.push("reload");
      expect(resetForm).toEqual(emptyLeadForm);
    });

    expect(events).toEqual(["request", "response", "reload"]);
    expect(fetcher).toHaveBeenCalledWith("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
  });

  it("sends selected organization in lead URL, never request body", async () => {
    const organizationId = "550e8400-e29b-41d4-a716-446655440000";
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ lead: { id: "lead-2", contact_id: "contact-2", stage_id: "stage-new" } }));
    const form = { name: "Bruno Lima", phone: "(11) 99999-0000", email: "", source: "whatsapp" as const };

    await submitCrmLead(fetcher, form, () => undefined, organizationId);

    expect(fetcher).toHaveBeenCalledWith(`/api/crm/leads?organization_id=${organizationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
  });

  it("sends stage and snapshot timestamp, then applies server-authoritative move state only after success", async () => {
    const applyMove = vi.fn();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Stage not found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ lead: { id: "lead-1", stage_id: "stage-server", updated_at: "2026-09-22T12:00:01.000Z" } }));

    await expect(requestLeadMove(fetcher, "lead-1", "stage-won", lead.updated_at, applyMove)).rejects.toThrow("Stage not found");
    expect(applyMove).not.toHaveBeenCalled();

    await requestLeadMove(fetcher, "lead-1", "stage-won", lead.updated_at, applyMove);
    expect(fetcher).toHaveBeenLastCalledWith("/api/crm/leads/lead-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: "stage-won", updated_at: lead.updated_at }),
    });
    expect(applyMove).toHaveBeenCalledOnce();
    expect(applyMove).toHaveBeenCalledWith("lead-1", "stage-server", "2026-09-22T12:00:01.000Z");
  });

  it("sends selected organization in move URL, never patch body", async () => {
    const organizationId = "550e8400-e29b-41d4-a716-446655440000";
    const applyMove = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ lead: { id: "lead-1", stage_id: "stage-server", updated_at: "2026-09-22T12:00:01.000Z" } }));

    await requestLeadMove(fetcher, "lead-1", "stage-won", lead.updated_at, applyMove, organizationId);

    expect(fetcher).toHaveBeenCalledWith(`/api/crm/leads/lead-1?organization_id=${organizationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: "stage-won", updated_at: lead.updated_at }),
    });
  });

  it("keeps each move disabled until its own request settles", () => {
    let movingLeadIds = addMovingLead(new Set(), "lead-a");
    movingLeadIds = addMovingLead(movingLeadIds, "lead-b");
    movingLeadIds = removeMovingLead(movingLeadIds, "lead-a");

    expect(movingLeadIds.has("lead-a")).toBe(false);
    expect(movingLeadIds.has("lead-b")).toBe(true);
  });

  it("locks organization selection during save or lead move", () => {
    expect(isOrganizationSelectorDisabled({ loading: false, saving: true, movingLeadCount: 0 })).toBe(true);
    expect(isOrganizationSelectorDisabled({ loading: false, saving: false, movingLeadCount: 1 })).toBe(true);
    expect(isOrganizationSelectorDisabled({ loading: false, saving: false, movingLeadCount: 0 })).toBe(false);
  });

  it("rejects form submission while a pipeline snapshot is loading", () => {
    expect(canSubmitCrmLead({ loading: true, saving: false })).toBe(false);
    expect(canSubmitCrmLead({ loading: false, saving: true })).toBe(false);
    expect(canSubmitCrmLead({ loading: false, saving: false })).toBe(true);
  });

  it("disables every lead form control while loading or saving", () => {
    expect(isLeadFormDisabled({ loading: true, saving: false })).toBe(true);
    expect(isLeadFormDisabled({ loading: false, saving: true })).toBe(true);
    expect(isLeadFormDisabled({ loading: false, saving: false })).toBe(false);
  });

  it("ignores an older pipeline snapshot after canonical reload starts", () => {
    const requests = new PipelineRequestTracker();
    const initialSnapshot = requests.start();
    const canonicalReload = requests.start();

    expect(requests.isCurrent(initialSnapshot)).toBe(false);
    expect(requests.isCurrent(canonicalReload)).toBe(true);
  });

  it("does not let a prior-tenant response replace selected tenant pipeline state", () => {
    const selectedOrganizationId = "organization-b";
    const pipelineState = { organizationId: selectedOrganizationId, leadIds: ["lead-b"] };
    const priorTenantResponse = { organizationId: "organization-a", leadIds: ["lead-a"] };

    if (shouldApplyPipelineResponse(priorTenantResponse.organizationId, selectedOrganizationId)) {
      pipelineState.organizationId = priorTenantResponse.organizationId;
      pipelineState.leadIds = priorTenantResponse.leadIds;
    }

    expect(pipelineState).toEqual({ organizationId: "organization-b", leadIds: ["lead-b"] });
  });

  it("builds a unique move label containing the lead contact name", () => {
    expect(getMoveLeadAriaLabel("Ana Souza", "lead-1")).toBe("Mover Ana Souza (lead-1) para outra etapa");
    expect(getMoveLeadAriaLabel("Ana Souza", "lead-2")).not.toBe(
      getMoveLeadAriaLabel("Ana Souza", "lead-1"),
    );
  });
});

describe("CRM view labels", () => {
  it("uses UTF-8 Portuguese when CRM loading fails", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: "Falha" }, 500));

    await expect(loadCrmPipeline(fetcher)).rejects.toThrow("Não foi possível carregar o CRM.");
  });

  it("shows organization selector only when context supplies admin-visible organizations", () => {
    expect(shouldShowOrganizationSelector([])).toBe(false);
    expect(shouldShowOrganizationSelector([{ id: "org-1", name: "Acme" }])).toBe(true);
  });

  it("exposes loading, error, and empty labels for rendering", () => {
    expect(getCrmPipelineViewLabels({ loading: true, error: null, columnCount: 0 })).toEqual({
      loading: "Carregando pipeline...",
      error: null,
      empty: null,
    });
    expect(getCrmPipelineViewLabels({ loading: false, error: "Falha", columnCount: 0 })).toEqual({
      loading: null,
      error: "Falha",
      empty: null,
    });
    expect(getCrmPipelineViewLabels({ loading: false, error: null, columnCount: 0 })).toEqual({
      loading: null,
      error: null,
      empty: "Nenhuma etapa de pipeline disponível.",
    });
  });
});

describe("dashboard header actions", () => {
  it("keeps CRM between admin and logout for administrators", () => {
    expect(getDashboardHeaderActions("admin")).toEqual(["admin", "crm", "logout"]);
  });

  it("keeps CRM and logout for non-admin users", () => {
    expect(getDashboardHeaderActions("user")).toEqual(["crm", "logout"]);
  });
});
