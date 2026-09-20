import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFacebookToken } from "@/lib/meta-token";

export const dynamic = "force-dynamic";
import {
  fetchAdAccountInsights,
  fetchAdAccountInsightsDaily,
  fetchPlatformBreakdown,
  fetchVideoRetention,
  fetchFunnelActions,
} from "@/lib/meta-api";

const PREVIOUS_PERIOD: Record<string, string> = {
  today: "yesterday",
  yesterday: "last_3d",
  last_3d: "last_7d",
  last_7d: "last_14d",
  last_30d: "last_90d",
  this_month: "last_month",
  last_month: "last_3_months",
};

function calcVariation(current: string, previous: string): number | null {
  const c = parseFloat(current);
  const p = parseFloat(previous);
  if (isNaN(c) || isNaN(p) || p === 0) return null;
  return ((c - p) / p) * 100;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const rawPreset = searchParams.get("date_preset") ?? "last_30d";
  const datePreset = since && until ? `custom:${since}:${until}` : rawPreset;

  const adAccountId = user.user_metadata?.selected_ad_account_id;
  if (!adAccountId) {
    return NextResponse.json({ error: "Nenhuma conta selecionada" }, { status: 400 });
  }

  const { token } = await getFacebookToken();
  if (!token) {
    return NextResponse.json({ error: "Token do Facebook não disponível" }, { status: 403 });
  }

  // For custom date ranges, compute the equivalent previous period
  let prevPreset: string;
  if (since && until) {
    const sinceDate = new Date(since);
    const untilDate = new Date(until);
    const daysDiff = Math.round((untilDate.getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const prevUntil = new Date(sinceDate.getTime() - 1000 * 60 * 60 * 24);
    const prevSince = new Date(prevUntil.getTime() - (daysDiff - 1) * 1000 * 60 * 60 * 24);
    const toISO = (d: Date) => d.toISOString().split("T")[0];
    prevPreset = `custom:${toISO(prevSince)}:${toISO(prevUntil)}`;
  } else {
    prevPreset = PREVIOUS_PERIOD[datePreset] ?? "last_90d";
  }

  const [overview, daily, platforms, videoRaw, funnelActions, prevOverview] = await Promise.all([
    fetchAdAccountInsights(adAccountId, token, datePreset),
    fetchAdAccountInsightsDaily(adAccountId, token, datePreset),
    fetchPlatformBreakdown(adAccountId, token, datePreset),
    fetchVideoRetention(adAccountId, token, datePreset),
    fetchFunnelActions(adAccountId, token, datePreset),
    fetchAdAccountInsights(adAccountId, token, prevPreset),
  ]);

  const purchaseActionValue = overview?.action_values?.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );
  const purchaseAction = overview?.actions?.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );

  const roas = purchaseActionValue && overview?.spend
    ? parseFloat(purchaseActionValue.value) / parseFloat(overview.spend)
    : null;

  // Comparação com período anterior
  const prevPurchaseActionValue = prevOverview?.action_values?.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );
  const prevPurchaseAction = prevOverview?.actions?.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );
  const prevRoas = prevPurchaseActionValue && prevOverview?.spend
    ? parseFloat(prevPurchaseActionValue.value) / parseFloat(prevOverview.spend)
    : null;

  const prevCpc = parseFloat(prevOverview?.clicks ?? "0") > 0
    ? parseFloat(prevOverview?.spend ?? "0") / parseFloat(prevOverview?.clicks ?? "1")
    : null;
  const currentCpc = parseFloat(overview?.clicks ?? "0") > 0
    ? parseFloat(overview?.spend ?? "0") / parseFloat(overview?.clicks ?? "1")
    : null;

  const comparison = {
    spend: calcVariation(overview?.spend ?? "0", prevOverview?.spend ?? "0"),
    impressions: calcVariation(overview?.impressions ?? "0", prevOverview?.impressions ?? "0"),
    clicks: calcVariation(overview?.clicks ?? "0", prevOverview?.clicks ?? "0"),
    ctr: calcVariation(overview?.ctr ?? "0", prevOverview?.ctr ?? "0"),
    cpm: calcVariation(overview?.cpm ?? "0", prevOverview?.cpm ?? "0"),
    purchases: calcVariation(purchaseAction?.value ?? "0", prevPurchaseAction?.value ?? "0"),
    roas: roas !== null && prevRoas !== null && prevRoas > 0
      ? ((roas - prevRoas) / prevRoas) * 100
      : null,
    cpc: currentCpc !== null && prevCpc !== null && prevCpc > 0
      ? ((currentCpc - prevCpc) / prevCpc) * 100
      : null,
  };

  // Retenção de vídeo em percentual (null quando não há impressões para evitar valores fantasma)
  const videoImpressions = parseInt(overview?.impressions ?? "0", 10);
  const videoRetention = videoRaw && videoImpressions > 0
    ? {
        p25: Math.round((parseInt(videoRaw.video_p25_watched_actions?.[0]?.value ?? "0", 10) / videoImpressions) * 100),
        p50: Math.round((parseInt(videoRaw.video_p50_watched_actions?.[0]?.value ?? "0", 10) / videoImpressions) * 100),
        p75: Math.round((parseInt(videoRaw.video_p75_watched_actions?.[0]?.value ?? "0", 10) / videoImpressions) * 100),
        p100: Math.round((parseInt(videoRaw.video_p100_watched_actions?.[0]?.value ?? "0", 10) / videoImpressions) * 100),
      }
    : null;

  // Distribuição por plataforma
  const totalSpendPlatform = platforms.reduce((s, p) => s + parseFloat(p.spend ?? "0"), 0) || 1;
  const platformBreakdown = platforms.map((p) => ({
    platform: p.publisher_platform,
    percent: Math.round((parseFloat(p.spend ?? "0") / totalSpendPlatform) * 100),
    spend: p.spend,
  }));

  // Funil real com pixel events
  const funnel = {
    impressions: parseInt(overview?.impressions ?? "0", 10),
    clicks: parseInt(overview?.clicks ?? "0", 10),
    landing_page_view: funnelActions["landing_page_view"] ?? 0,
    view_content: funnelActions["offsite_conversion.fb_pixel_view_content"] ?? funnelActions["view_content"] ?? 0,
    add_to_cart: funnelActions["offsite_conversion.fb_pixel_add_to_cart"] ?? funnelActions["add_to_cart"] ?? 0,
    initiate_checkout: funnelActions["offsite_conversion.fb_pixel_initiate_checkout"] ?? funnelActions["initiate_checkout"] ?? 0,
    purchase: funnelActions["offsite_conversion.fb_pixel_purchase"] ?? funnelActions["purchase"] ?? 0,
    lead: funnelActions["offsite_conversion.fb_pixel_lead"] ?? funnelActions["lead"] ?? 0,
  };

  // Frequência: usa o valor da API quando disponível e > 0,
  // caso contrário calcula manualmente: Impressões / Alcance
  const apiFrequency = parseFloat(overview?.frequency ?? "0");
  const impressionsNum = parseFloat(overview?.impressions ?? "0");
  const reachNum = parseFloat(overview?.reach ?? "0");
  const computedFrequency =
    apiFrequency > 0
      ? apiFrequency
      : reachNum > 0
      ? impressionsNum / reachNum
      : 0;

  return NextResponse.json({
    overview: {
      spend: overview?.spend ?? "0",
      impressions: overview?.impressions ?? "0",
      clicks: overview?.clicks ?? "0",
      ctr: overview?.ctr ?? "0",
      cpm: overview?.cpm ?? "0",
      reach: overview?.reach ?? "0",
      frequency: computedFrequency > 0 ? String(computedFrequency) : "0",
      purchases: purchaseAction?.value ?? "0",
      purchaseValue: purchaseActionValue?.value ?? "0",
      roas,
    },
    comparison,
    daily,
    platformBreakdown,
    videoRetention,
    funnel,
  });
}
