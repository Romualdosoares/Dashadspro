import { NextResponse } from "next/server";
import { requireOrganizationFeature } from "../../../../lib/feature-access";
import { getFacebookToken } from "@/lib/meta-token";
import { buildDateParam } from "@/lib/meta-api";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface BreakdownRow {
  age?: string;
  gender?: string;
  region?: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
}

async function fetchBreakdown(
  adAccountId: string,
  token: string,
  datePreset: string,
  breakdown: string
): Promise<BreakdownRow[]> {
  try {
    const fields = "spend,impressions,clicks,ctr,actions";
    const url = `${GRAPH_BASE}/${adAccountId}/insights?fields=${fields}&${buildDateParam(datePreset)}&breakdowns=${breakdown}&limit=50&access_token=${token}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const access = await requireOrganizationFeature("dashboard_ads", searchParams.get("organization_id"));
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { user } = access;
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const rawPreset = searchParams.get("date_preset") ?? "last_30d";
  const datePreset = since && until ? `custom:${since}:${until}` : rawPreset;

  const adAccountId = user.user_metadata?.selected_ad_account_id;
  if (!adAccountId) return NextResponse.json({ error: "Nenhuma conta selecionada" }, { status: 400 });

  const { token } = await getFacebookToken(user);
  if (!token) return NextResponse.json({ error: "Token do Facebook não disponível" }, { status: 403 });

  const [ageGender, region] = await Promise.all([
    fetchBreakdown(adAccountId, token, datePreset, "age,gender"),
    fetchBreakdown(adAccountId, token, datePreset, "region"),
  ]);

  return NextResponse.json({ ageGender, region });
}
