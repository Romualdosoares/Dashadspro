import type { MetaBusiness, MetaAdAccount, AdInsights } from "./types";
import { GRAPH_BASE } from "./meta-config";

export class MetaApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "MetaApiError";
  }
}

async function fetchMetaCollection<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    throw new MetaApiError(
      data.error?.message ?? `Meta API HTTP ${res.status}`,
      res.status,
    );
  }

  return data.data ?? [];
}

/** Build Meta API date query param string.
 *  Preset "custom:YYYY-MM-DD:YYYY-MM-DD" → time_range; otherwise → date_preset */
export function buildDateParam(preset: string): string {
  if (preset.startsWith("custom:")) {
    const [, since, until] = preset.split(":");
    return `time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`;
  }
  return `date_preset=${preset}`;
}

export async function fetchUserBusinesses(accessToken: string): Promise<MetaBusiness[]> {
  const url = `${GRAPH_BASE}/me/businesses?fields=id,name&limit=200&access_token=${accessToken}`;
  return fetchMetaCollection<MetaBusiness>(url);
}

export async function fetchUserAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const fields = "id,name,account_status,currency";
  const url = `${GRAPH_BASE}/me/adaccounts?fields=${fields}&limit=200&access_token=${accessToken}`;
  return fetchMetaCollection<MetaAdAccount>(url);
}

export async function fetchBusinessAdAccounts(
  businessId: string,
  accessToken: string
): Promise<MetaAdAccount[]> {
  const fields = "id,name,account_status,currency";
  const [ownedAccounts, clientAccounts] = await Promise.all([
    fetchMetaCollection<MetaAdAccount>(
      `${GRAPH_BASE}/${businessId}/owned_ad_accounts?fields=${fields}&limit=200&access_token=${accessToken}`,
    ),
    fetchMetaCollection<MetaAdAccount>(
      `${GRAPH_BASE}/${businessId}/client_ad_accounts?fields=${fields}&limit=200&access_token=${accessToken}`,
    ),
  ]);

  const accounts = new Map<string, MetaAdAccount>();
  for (const account of [...ownedAccounts, ...clientAccounts]) {
    if (!accounts.has(account.id)) accounts.set(account.id, account);
  }
  return [...accounts.values()];
}

export async function fetchAdAccountInsights(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<AdInsights | null> {
  const fields = "spend,impressions,clicks,ctr,cpm,reach,frequency,actions,action_values";
  const url = `${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&access_token=${accessToken}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Meta API HTTP ${res.status}`);
  }
  return data.data?.[0] ?? null;
}

export interface DailyInsight {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
}

export async function fetchAdAccountInsightsDaily(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<DailyInsight[]> {
  try {
    const fields = "impressions,clicks,spend";
    const url = `${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&time_increment=1&access_token=${accessToken}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map((d: any) => ({
      date: d.date_start,
      impressions: parseInt(d.impressions ?? "0", 10),
      clicks: parseInt(d.clicks ?? "0", 10),
      spend: parseFloat(d.spend ?? "0"),
    }));
  } catch {
    return [];
  }
}

export interface CampaignInsight {
  id: string;
  name: string;
  status: string;
  objective: string;
  buying_type: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  cpp: string;
  reach: string;
  frequency: string;
  daily_budget: string | null;
  lifetime_budget: string | null;
  budget_remaining: string | null;
  adset_daily_budget: string | null;
  adset_lifetime_budget: string | null;
  actions: Array<{ action_type: string; value: string }>;
  action_values: Array<{ action_type: string; value: string }>;
}

async function fetchCampaignMeta(
  adAccountId: string,
  accessToken: string
): Promise<Record<string, { objective: string; buying_type: string; status: string; daily_budget: string | null; lifetime_budget: string | null; budget_remaining: string | null }>> {
  try {
    const url = `${GRAPH_BASE}/${adAccountId}/campaigns?fields=id,objective,buying_type,status,daily_budget,lifetime_budget,budget_remaining&limit=200&access_token=${accessToken}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, { objective: string; buying_type: string; status: string; daily_budget: string | null; lifetime_budget: string | null; budget_remaining: string | null }> = {};
    for (const c of data.data ?? []) {
      map[c.id] = {
        objective: c.objective ?? "",
        buying_type: c.buying_type ?? "",
        status: c.status ?? "",
        daily_budget: c.daily_budget ?? null,
        lifetime_budget: c.lifetime_budget ?? null,
        budget_remaining: c.budget_remaining ?? null,
      };
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchAdsetBudgets(
  adAccountId: string,
  accessToken: string
): Promise<Record<string, { daily_budget: string | null; lifetime_budget: string | null }>> {
  try {
    const url = `${GRAPH_BASE}/${adAccountId}/adsets?fields=id,campaign_id,daily_budget,lifetime_budget&limit=200&access_token=${accessToken}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return {};
    const data = await res.json();
    // Sum adset budgets per campaign
    const map: Record<string, { daily_budget: string | null; lifetime_budget: string | null }> = {};
    for (const s of data.data ?? []) {
      const cid = s.campaign_id;
      if (!cid) continue;
      if (!map[cid]) map[cid] = { daily_budget: null, lifetime_budget: null };
      if (s.daily_budget) {
        const prev = parseFloat(map[cid].daily_budget ?? "0");
        map[cid].daily_budget = String(prev + parseFloat(s.daily_budget));
      }
      if (s.lifetime_budget) {
        const prev = parseFloat(map[cid].lifetime_budget ?? "0");
        map[cid].lifetime_budget = String(prev + parseFloat(s.lifetime_budget));
      }
    }
    return map;
  } catch {
    return {};
  }
}

export async function fetchCampaignInsights(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<CampaignInsight[]> {
  try {
    const fields = "campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,cpp,reach,frequency,actions,action_values";
    const [insightsRes, metaMap, adsetBudgets] = await Promise.all([
      fetch(`${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&level=campaign&limit=200&access_token=${accessToken}`, { next: { revalidate: 300 } }),
      fetchCampaignMeta(adAccountId, accessToken),
      fetchAdsetBudgets(adAccountId, accessToken),
    ]);
    if (!insightsRes.ok) return [];
    const data = await insightsRes.json();
    return (data.data ?? []).map((d: any) => {
      const meta = metaMap[d.campaign_id] ?? { objective: "", buying_type: "", status: "UNKNOWN" };
      const actions: Array<{ action_type: string; value: string }> = d.actions ?? [];

      // Detecta objetivo real pelas ações — sobrescreve se API retornou genérico
      const hasMessages = actions.some((a) =>
        a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
        a.action_type === "onsite_conversion.total_messaging_connection"
      );
      const hasLeads = actions.some((a) =>
        a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead"
      );
      const hasPurchases = actions.some((a) =>
        a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
      );

      let resolvedObjective = meta.objective;
      // Se a API diz OUTCOME_SALES mas as ações mostram mensagens sem compras → é MESSAGES
      if (
        (resolvedObjective === "OUTCOME_SALES" || resolvedObjective === "CONVERSIONS") &&
        hasMessages && !hasPurchases
      ) {
        resolvedObjective = "MESSAGES";
      }
      // Se tem leads e não tem compras → LEAD_GENERATION
      if (
        (resolvedObjective === "OUTCOME_SALES" || resolvedObjective === "CONVERSIONS") &&
        hasLeads && !hasPurchases
      ) {
        resolvedObjective = "LEAD_GENERATION";
      }

      const adsets = adsetBudgets[d.campaign_id] ?? { daily_budget: null, lifetime_budget: null };
      return {
        id: d.campaign_id,
        name: d.campaign_name,
        status: meta.status,
        objective: resolvedObjective,
        buying_type: meta.buying_type,
        spend: d.spend ?? "0",
        impressions: d.impressions ?? "0",
        clicks: d.clicks ?? "0",
        ctr: d.ctr ?? "0",
        cpc: d.cpc ?? "0",
        cpm: d.cpm ?? "0",
        cpp: d.cpp ?? "0",
        reach: d.reach ?? "0",
        frequency: d.frequency ?? "0",
        daily_budget: meta.daily_budget,
        lifetime_budget: meta.lifetime_budget,
        budget_remaining: meta.budget_remaining,
        adset_daily_budget: adsets.daily_budget,
        adset_lifetime_budget: adsets.lifetime_budget,
        actions: d.actions ?? [],
        action_values: d.action_values ?? [],
      };
    });
  } catch {
    return [];
  }
}

export interface AdInsightRow {
  id: string;
  name: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach: string;
  actions: Array<{ action_type: string; value: string }>;
  action_values: Array<{ action_type: string; value: string }>;
}

export async function fetchAdInsights(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<AdInsightRow[]> {
  try {
    const fields = "ad_name,ad_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,actions,action_values";
    const [insightsRes, adsRes] = await Promise.all([
      fetch(`${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&level=ad&limit=20&access_token=${accessToken}`, { next: { revalidate: 300 } }),
      fetch(`${GRAPH_BASE}/${adAccountId}/ads?fields=id,status&limit=100&access_token=${accessToken}`, { next: { revalidate: 300 } }),
    ]);
    if (!insightsRes.ok) return [];
    const data = await insightsRes.json();

    const adStatusMap: Record<string, string> = {};
    if (adsRes.ok) {
      const adsData = await adsRes.json();
      for (const a of adsData.data ?? []) {
        adStatusMap[a.id] = a.status ?? "UNKNOWN";
      }
    }

    return (data.data ?? []).map((d: any) => ({
      id: d.ad_id,
      name: d.ad_name,
      adset_name: d.adset_name ?? "",
      campaign_id: d.campaign_id ?? "",
      campaign_name: d.campaign_name ?? "",
      status: adStatusMap[d.ad_id] ?? "UNKNOWN",
      spend: d.spend ?? "0",
      impressions: d.impressions ?? "0",
      clicks: d.clicks ?? "0",
      ctr: d.ctr ?? "0",
      cpc: d.cpc ?? "0",
      cpm: d.cpm ?? "0",
      reach: d.reach ?? "0",
      actions: d.actions ?? [],
      action_values: d.action_values ?? [],
    }));
  } catch {
    return [];
  }
}

export interface AdsetInsightRow {
  id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  optimization_goal: string;
  billing_event: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  reach: string;
  frequency: string;
  daily_budget: string | null;
  lifetime_budget: string | null;
  budget_remaining: string | null;
  actions: Array<{ action_type: string; value: string }>;
  action_values: Array<{ action_type: string; value: string }>;
}

export async function fetchAdsetInsights(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<AdsetInsightRow[]> {
  try {
    const fields = "adset_name,adset_id,campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values";
    const [insightsRes, adsetsRes] = await Promise.all([
      fetch(`${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&level=adset&limit=100&access_token=${accessToken}`, { next: { revalidate: 300 } }),
      fetch(`${GRAPH_BASE}/${adAccountId}/adsets?fields=id,name,status,optimization_goal,billing_event,daily_budget,lifetime_budget,budget_remaining&limit=200&access_token=${accessToken}`, { next: { revalidate: 300 } }),
    ]);
    if (!insightsRes.ok) return [];
    const insData = await insightsRes.json();
    // Build adset meta map
    const adsetMeta: Record<string, { status: string; optimization_goal: string; billing_event: string; daily_budget: string | null; lifetime_budget: string | null; budget_remaining: string | null }> = {};
    if (adsetsRes.ok) {
      const adsetData = await adsetsRes.json();
      for (const a of adsetData.data ?? []) {
        adsetMeta[a.id] = {
          status: a.status ?? "UNKNOWN",
          optimization_goal: a.optimization_goal ?? "",
          billing_event: a.billing_event ?? "",
          daily_budget: a.daily_budget ?? null,
          lifetime_budget: a.lifetime_budget ?? null,
          budget_remaining: a.budget_remaining ?? null,
        };
      }
    }
    return (insData.data ?? []).map((d: any) => {
      const meta = adsetMeta[d.adset_id] ?? { status: "UNKNOWN", optimization_goal: "", billing_event: "", daily_budget: null, lifetime_budget: null, budget_remaining: null };
      return {
        id: d.adset_id,
        name: d.adset_name,
        campaign_id: d.campaign_id,
        campaign_name: d.campaign_name,
        status: meta.status,
        optimization_goal: meta.optimization_goal,
        billing_event: meta.billing_event,
        spend: d.spend ?? "0",
        impressions: d.impressions ?? "0",
        clicks: d.clicks ?? "0",
        ctr: d.ctr ?? "0",
        cpc: d.cpc ?? "0",
        cpm: d.cpm ?? "0",
        reach: d.reach ?? "0",
        frequency: d.frequency ?? "0",
        daily_budget: meta.daily_budget,
        lifetime_budget: meta.lifetime_budget,
        budget_remaining: meta.budget_remaining,
        actions: d.actions ?? [],
        action_values: d.action_values ?? [],
      };
    });
  } catch {
    return [];
  }
}

export interface PublisherPlatformBreakdown {
  publisher_platform: string;
  spend: string;
  impressions: string;
}

export async function fetchPlatformBreakdown(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<PublisherPlatformBreakdown[]> {
  try {
    const fields = "publisher_platform,spend,impressions";
    const url = `${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&breakdowns=publisher_platform&access_token=${accessToken}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export interface VideoRetentionData {
  video_p25_watched_actions: Array<{ value: string }>;
  video_p50_watched_actions: Array<{ value: string }>;
  video_p75_watched_actions: Array<{ value: string }>;
  video_p100_watched_actions: Array<{ value: string }>;
}

export async function fetchVideoRetention(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<VideoRetentionData | null> {
  try {
    const fields = "video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions";
    const url = `${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&access_token=${accessToken}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchFunnelActions(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<Record<string, number>> {
  try {
    const fields = "actions";
    const url = `${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&access_token=${accessToken}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    const data = await res.json();
    const actions: Array<{ action_type: string; value: string }> = data.data?.[0]?.actions ?? [];
    const result: Record<string, number> = {};
    for (const a of actions) {
      result[a.action_type] = parseInt(a.value, 10);
    }
    return result;
  } catch {
    return {};
  }
}

export interface AdCreativeRow {
  id: string;
  name: string;
  thumbnail_url: string;
  status: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  actions: Array<{ action_type: string; value: string }>;
}

export async function fetchAdCreatives(
  adAccountId: string,
  accessToken: string,
  datePreset = "last_30d"
): Promise<AdCreativeRow[]> {
  try {
    const fields = "ad_name,ad_id,spend,impressions,clicks,ctr,cpc,actions";
    const url = `${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&level=ad&limit=10&access_token=${accessToken}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const insightsData = await res.json();
    const insights = insightsData.data ?? [];

    const adIds = insights.map((d: any) => d.ad_id).filter(Boolean);
    if (adIds.length === 0) return [];

    const thumbnailEntries = await Promise.all(
      adIds.slice(0, 10).map(async (adId: string) => {
        try {
          const adUrl = `${GRAPH_BASE}/${adId}?fields=creative{image_url,thumbnail_url,object_story_spec{video_data{image_url},link_data{picture}},asset_feed_spec{images}},status&access_token=${accessToken}`;
          const adRes = await fetch(adUrl, { next: { revalidate: 600 } });
          if (!adRes.ok) return [adId, ""] as [string, string];
          const adData = await adRes.json();
          const c = adData.creative;
          const img =
            c?.image_url ||
            c?.object_story_spec?.link_data?.picture ||
            c?.object_story_spec?.video_data?.image_url ||
            c?.thumbnail_url ||
            "";
          return [adId, img] as [string, string];
        } catch {
          return [adId, ""] as [string, string];
        }
      })
    );
    const thumbnails: Record<string, string> = Object.fromEntries(thumbnailEntries);

    return insights.map((d: any) => ({
      id: d.ad_id,
      name: d.ad_name,
      thumbnail_url: thumbnails[d.ad_id] ?? "",
      status: "UNKNOWN",
      spend: d.spend ?? "0",
      impressions: d.impressions ?? "0",
      clicks: d.clicks ?? "0",
      ctr: d.ctr ?? "0",
      cpc: d.cpc ?? "0",
      actions: d.actions ?? [],
    }));
  } catch {
    return [];
  }
}
