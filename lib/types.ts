export interface LocalSession {
  type: "local";
  email: string;
  name: string;
}

export interface FacebookSession {
  type: "facebook";
  accessToken: string;
  userId: string;
  name: string;
  email?: string;
  selectedAdAccountId?: string;
  selectedAdAccountName?: string;
  selectedBusinessId?: string;
  selectedBusinessName?: string;
}

export type Session = LocalSession | FacebookSession;

export interface MetaBusiness {
  id: string;
  name: string;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  business?: MetaBusiness;
}

export interface MetaApiResponse<T> {
  data: T[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

export interface AdInsights {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

export interface AccountInfo {
  adAccountId: string | null;
  adAccountName: string;
  userName: string;
}
