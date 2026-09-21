import { describe, expect, it, vi } from "vitest";
import { getCrmPageState } from "../lib/crm-page-state";
import {
  emptyLeadForm,
  getCrmPipelineViewLabels,
  loadCrmPipeline,
  requestLeadMove,
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

    await expect(loadCrmPipeline(fetcher)).resolves.toEqual({ stages, leads: [lead] });
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/crm/context");
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/crm/leads");
  });

  it("waits for lead creation response before updating UI state and clearing form", async () => {
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

    await submitCrmLead(fetcher, form, "2026-09-21T12:00:00.000Z", (createdLead, resetForm) => {
      events.push("apply");
      expect(createdLead).toMatchObject({
        id: "lead-2",
        contact_name: "Bruno Lima",
        contact_phone: "(11) 99999-0000",
        source: "whatsapp",
      });
      expect(resetForm).toEqual(emptyLeadForm);
    });

    expect(events).toEqual(["request", "response", "apply"]);
    expect(fetcher).toHaveBeenCalledWith("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
  });

  it("sends only stage_id and changes lead state only after a successful move", async () => {
    const applyMove = vi.fn();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Stage not found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ lead: { id: "lead-1", stage_id: "stage-won" } }));

    await expect(requestLeadMove(fetcher, "lead-1", "stage-won", applyMove)).rejects.toThrow("Stage not found");
    expect(applyMove).not.toHaveBeenCalled();

    await requestLeadMove(fetcher, "lead-1", "stage-won", applyMove);
    expect(fetcher).toHaveBeenLastCalledWith("/api/crm/leads/lead-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: "stage-won" }),
    });
    expect(applyMove).toHaveBeenCalledOnce();
    expect(applyMove).toHaveBeenCalledWith("lead-1", "stage-won");
  });
});

describe("CRM view labels", () => {
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
