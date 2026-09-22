export type OrganizationRole = "owner" | "manager" | "agent";
export type LeadSource = "manual" | "landing_page" | "whatsapp";
export type LeadStatus = "open" | "won" | "lost";

export interface CrmStage {
  id: string;
  name: string;
  position: number;
}

export interface CrmLead {
  id: string;
  contact_id: string;
  stage_id: string;
  source: LeadSource;
  status: LeadStatus;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
}
