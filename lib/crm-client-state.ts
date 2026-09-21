import type { CrmLead, CrmStage, LeadSource } from "./crm-types";

type CrmFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type LeadForm = {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
};

type CreatedLeadResponse = Pick<CrmLead, "id" | "contact_id" | "stage_id">;

export const emptyLeadForm: LeadForm = {
  name: "",
  phone: "",
  email: "",
  source: "manual",
};

export async function loadCrmPipeline(fetcher: CrmFetcher): Promise<{
  stages: CrmStage[];
  leads: CrmLead[];
}> {
  const [contextResponse, leadsResponse] = await Promise.all([
    fetcher("/api/crm/context"),
    fetcher("/api/crm/leads"),
  ]);
  const context = await contextResponse.json().catch(() => null) as { stages?: CrmStage[] } | null;
  const leadData = await leadsResponse.json().catch(() => null) as { leads?: CrmLead[] } | null;

  if (!contextResponse.ok || !leadsResponse.ok || !context || !leadData) {
    throw new Error("Não foi possível carregar o CRM.");
  }

  return {
    stages: Array.isArray(context.stages) ? context.stages : [],
    leads: Array.isArray(leadData.leads) ? leadData.leads : [],
  };
}

export async function submitCrmLead(
  fetcher: CrmFetcher,
  form: LeadForm,
  createdAt: string,
  applyCreatedLead: (lead: CrmLead, resetForm: LeadForm) => void,
): Promise<void> {
  const response = await fetcher("/api/crm/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await response.json().catch(() => null) as { lead?: CreatedLeadResponse; error?: string } | null;

  if (!response.ok || !data?.lead) {
    throw new Error(data?.error ?? "Não foi possível criar o lead.");
  }

  applyCreatedLead(
    {
      ...data.lead,
      source: form.source,
      status: "open",
      contact_name: form.name.trim(),
      contact_phone: form.phone.trim() || null,
      contact_email: form.email.trim() || null,
      created_at: createdAt,
    },
    emptyLeadForm,
  );
}

export async function requestLeadMove(
  fetcher: CrmFetcher,
  leadId: string,
  stageId: string,
  applyMove: (leadId: string, stageId: string) => void,
): Promise<void> {
  const response = await fetcher(`/api/crm/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage_id: stageId }),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error ?? "Não foi possível mover o lead.");
  }

  applyMove(leadId, stageId);
}

export function getCrmPipelineViewLabels({
  loading,
  error,
  columnCount,
}: {
  loading: boolean;
  error: string | null;
  columnCount: number;
}) {
  return {
    loading: loading ? "Carregando pipeline..." : null,
    error,
    empty: !loading && !error && columnCount === 0 ? "Nenhuma etapa de pipeline disponível." : null,
  };
}
