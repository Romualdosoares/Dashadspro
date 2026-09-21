import type { CrmLead, CrmStage } from "./crm-types";

export type CrmPipelineColumn = {
  stage: CrmStage;
  leads: CrmLead[];
};

export function buildPipelineColumns(
  stages: CrmStage[],
  leads: CrmLead[],
): CrmPipelineColumn[] {
  const orderedStages = [...stages].sort((left, right) => left.position - right.position);
  const leadsByStage = new Map<string, CrmLead[]>();

  for (const lead of leads) {
    const stageLeads = leadsByStage.get(lead.stage_id) ?? [];
    stageLeads.push(lead);
    leadsByStage.set(lead.stage_id, stageLeads);
  }

  return orderedStages.map((stage) => ({
    stage,
    leads: leadsByStage.get(stage.id) ?? [],
  }));
}
