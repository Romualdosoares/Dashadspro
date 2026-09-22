import { NextResponse } from "next/server";
import { requireOrganizationFeature } from "../../../../lib/feature-access";
import { getFacebookToken } from "@/lib/meta-token";
import { fetchAdInsights } from "@/lib/meta-api";

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
  if (!adAccountId) {
    return NextResponse.json({ error: "Nenhuma conta selecionada" }, { status: 400 });
  }

  const { token } = await getFacebookToken(user);
  if (!token) {
    return NextResponse.json({ error: "Token do Facebook não disponível" }, { status: 403 });
  }

  const ads = await fetchAdInsights(adAccountId, token, datePreset);
  return NextResponse.json({ ads });
}
