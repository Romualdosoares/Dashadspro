import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFacebookToken } from "@/lib/meta-token";
import { fetchAdCreatives } from "@/lib/meta-api";

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
  if (!adAccountId) return NextResponse.json({ error: "Nenhuma conta selecionada" }, { status: 400 });

  const { token } = await getFacebookToken();
  if (!token) return NextResponse.json({ error: "Token do Facebook não disponível" }, { status: 403 });

  const creatives = await fetchAdCreatives(adAccountId, token, datePreset);
  return NextResponse.json({ creatives });
}
