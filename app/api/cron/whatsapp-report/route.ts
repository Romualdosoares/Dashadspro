import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchReportData, buildWhatsAppMessage, sendZapiMessage } from "@/lib/whatsapp-report";
import { decryptSecret } from "@/lib/secret-storage";
import { isReportDue } from "@/lib/report-schedule";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const { data: configs, error } = await admin
    .from("whatsapp_reports")
    .select("user_id,phone,zapi_instance,zapi_token,date_preset,schedule_hours,schedule,schedule_timezone,last_sent_at")
    .eq("enabled", true)
    .neq("schedule", "manual");
  if (error) {
    console.error("[cron/whatsapp-report] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matchingConfigs = (configs ?? []).filter((config) => isReportDue(config, now));
  if (matchingConfigs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, message: "No reports scheduled for this hour." });
  }

  const results = await Promise.allSettled(matchingConfigs.map(async (config) => {
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(config.user_id);
    if (userError || !userData?.user) throw userError ?? new Error("Usuario nao encontrado");

    const adAccountId = userData.user.user_metadata?.selected_ad_account_id as string | undefined;
    const accountName = userData.user.user_metadata?.selected_ad_account_name as string | undefined;
    if (!adAccountId) throw new Error("Conta de anuncios nao selecionada");

    const { data: tokenRow, error: tokenError } = await admin
      .from("facebook_tokens")
      .select("access_token_encrypted")
      .eq("user_id", config.user_id)
      .maybeSingle();
    if (tokenError || !tokenRow?.access_token_encrypted || tokenRow.access_token_encrypted === "pending") {
      throw tokenError ?? new Error("Token Meta indisponivel");
    }

    const [fbToken, zapiToken] = await Promise.all([
      decryptSecret(admin, tokenRow.access_token_encrypted),
      decryptSecret(admin, config.zapi_token),
    ]);
    const reportData = await fetchReportData(adAccountId, fbToken, config.date_preset ?? "today", accountName);
    const result = await sendZapiMessage(config.phone, config.zapi_instance, zapiToken, buildWhatsAppMessage(reportData));
    if (!result.ok) throw new Error(result.error ?? "Falha Z-API");

    const { error: updateError } = await admin
      .from("whatsapp_reports")
      .update({ last_sent_at: now.toISOString() })
      .eq("user_id", config.user_id);
    if (updateError) throw updateError;
  }));

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`[cron/whatsapp-report] Failed for user ${matchingConfigs[index].user_id}:`, result.reason);
    }
  });
  const sent = results.filter((result) => result.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent, failed: results.length - sent, total: matchingConfigs.length });
}
