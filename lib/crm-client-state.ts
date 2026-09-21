import type { CrmLead, CrmStage, LeadSource } from "./crm-types";

type CrmFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type LeadForm = {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
};

type UpdatedLeadResponse = Pick<CrmLead, "id" | "stage_id">;

export const emptyLeadForm: LeadForm = {
  name: "",
  phone: "",
  email: "",
  source: "manual",
};

export class PipelineRequestTracker {
  private currentGeneration = 0;

  start(): number {
    this.currentGeneration += 1;
    return this.currentGeneration;
  }

  isCurrent(generation: number): boolean {
    return generation === this.currentGeneration;
  }
}

export function canSubmitCrmLead({ loading, saving }: { loading: boolean; saving: boolean }): boolean {
  return !loading && !saving;
}

export function isLeadFormDisabled({ loading, saving }: { loading: boolean; saving: boolean }): boolean {
  return !canSubmitCrmLead({ loading, saving });
}

export function addMovingLead(currentLeadIds: Set<string>, leadId: string): Set<string> {
  return new Set(currentLeadIds).add(leadId);
}

export function removeMovingLead(currentLeadIds: Set<string>, leadId: string): Set<string> {
  const nextLeadIds = new Set(currentLeadIds);
  nextLeadIds.delete(leadId);
  return nextLeadIds;
}

export function getMoveLeadAriaLabel(contactName: string, leadId: string): string {
  return `Mover ${contactName || "contato sem nome"} (${leadId}) para outra etapa`;
}

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
  reloadCanonicalPipeline: (resetForm: LeadForm) => void | Promise<void>,
): Promise<void> {
  const response = await fetcher("/api/crm/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const data = await response.json().catch(() => null) as { lead?: UpdatedLeadResponse; error?: string } | null;

  if (!response.ok || !data?.lead) {
    throw new Error(data?.error ?? "Não foi possível criar o lead.");
  }

  await reloadCanonicalPipeline(emptyLeadForm);
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
  const data = await response.json().catch(() => null) as { lead?: UpdatedLeadResponse; error?: string } | null;

  if (!response.ok || !data?.lead) {
    throw new Error(data?.error ?? "Não foi possível mover o lead.");
  }

  applyMove(data.lead.id, data.lead.stage_id);
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
