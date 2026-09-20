import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFacebookToken } from "@/lib/meta-token";
import { fetchAdAccountInsights } from "@/lib/meta-api";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get("date_preset") ?? "last_30d";

  // Pega IDs das contas passadas via query string, ou usa a conta selecionada
  const idsParam = searchParams.get("ids");
  let accountIds: string[] = idsParam ? idsParam.split(",").filter(Boolean) : [];

  // Se não passaram IDs, usa a conta selecionada como fallback
  if (accountIds.length === 0) {
    const selectedId = user.user_metadata?.selected_ad_account_id;
    if (selectedId) accountIds = [selectedId];
  }

  if (accountIds.length === 0) {
    return NextResponse.json({ error: "Nenhuma conta selecionada" }, { status: 400 });
  }

  const { token } = await getFacebookToken();
  if (!token) {
    return NextResponse.json({ error: "Token do Facebook não disponível" }, { status: 403 });
  }

  // Busca insights de todas as contas em paralelo
  const results = await Promise.allSettled(
    accountIds.map(async (id) => {
      const overview = await fetchAdAccountInsights(id, token, datePreset);
      const purchaseValue = overview?.action_values?.find(
        (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
      );
      const purchaseAction = overview?.actions?.find(
        (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
      );
      const spend = parseFloat(overview?.spend ?? "0");
      const roas = purchaseValue && spend > 0
        ? parseFloat(purchaseValue.value) / spend
        : null;

      return {
        id,
        spend: overview?.spend ?? "0",
        impressions: overview?.impressions ?? "0",
        clicks: overview?.clicks ?? "0",
        ctr: overview?.ctr ?? "0",
        cpm: overview?.cpm ?? "0",
        reach: overview?.reach ?? "0",
        purchases: purchaseAction?.value ?? "0",
        purchaseValue: purchaseValue?.value ?? "0",
        roas,
      };
    })
  );

  const accounts = results
    .map((r, i) => {
      const base = r.status === "fulfilled" ? r.value : {
        id: accountIds[i],
        spend: "0", impressions: "0", clicks: "0", ctr: "0",
        cpm: "0", reach: "0", purchases: "0", purchaseValue: "0", roas: null,
      };
      return { ...base, id: accountIds[i], error: r.status === "rejected" };
    });

  // Totais consolidados
  const totals = accounts.reduce(
    (acc, a) => ({
      spend: acc.spend + parseFloat(a.spend),
      impressions: acc.impressions + parseInt(a.impressions, 10),
      clicks: acc.clicks + parseInt(a.clicks, 10),
      reach: acc.reach + parseInt(a.reach, 10),
      purchases: acc.purchases + parseInt(a.purchases, 10),
      purchaseValue: acc.purchaseValue + parseFloat(a.purchaseValue),
    }),
    { spend: 0, impressions: 0, clicks: 0, reach: 0, purchases: 0, purchaseValue: 0 }
  );

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const totalRoas = totals.spend > 0 ? totals.purchaseValue / totals.spend : null;

  return NextResponse.json({
    accounts,
    totals: {
      ...totals,
      ctr: totalCtr,
      cpm: totalCpm,
      roas: totalRoas,
    },
  });
}
