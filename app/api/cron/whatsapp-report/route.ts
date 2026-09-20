import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchReportData, buildWhatsAppMessage, sendZapiMessage } from "@/lib/whatsapp-report";
import { fetchAdAccountInsights, fetchCampaignInsights } from "@/lib/meta-api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify Vercel cron secret to prevent unauthorized invocations
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Current time reference — we need to check per-config timezone
  const nowUtc = new Date();

  // Query all enabled non-manual configs (timezone filtering done in-process below)
  const { data: configs, error } = await admin
    .from("whatsapp_reports")
    .select("user_id,phone,zapi_instance,zapi_token,date_preset,schedule_hours,schedule,schedule_timezone")
    .eq("enabled", true)
    .neq("schedule", "manual");

  if (error) {
    console.error("[cron/whatsapp-report] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!configs || configs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No reports scheduled for this hour." });
  }

  // Filter configs by converting current UTC time to each user's local timezone
  const matchingConfigs = configs.filter((cfg) => {
    try {
      const tz = cfg.schedule_timezone ?? "America/Sao_Paulo";
      const localHour = parseInt(
        new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(nowUtc),
        10
      );
      return Array.isArray(cfg.schedule_hours) && cfg.schedule_hours.includes(localHour);
    } catch {
      // Invalid timezone — fall back to UTC
      const utcHour = nowUtc.getUTCHours();
      return Array.isArray(cfg.schedule_hours) && cfg.schedule_hours.includes(utcHour);
    }
  });

  if (matchingConfigs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No reports scheduled for this hour." });
  }

  let sent = 0;
  let failed = 0;

  for (const cfg of matchingConfigs) {
    try {
      // Get user metadata (ad account)
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(cfg.user_id);
      if (userError || !userData?.user) continue;

      const adAccountId = userData.user.user_metadata?.selected_ad_account_id as string | undefined;
      const accountName = userData.user.user_metadata?.selected_ad_account_name as string | undefined;
      if (!adAccountId) continue;

      // Get and decrypt Facebook token
      const { data: tokenRow } = await admin
        .from("facebook_tokens")
        .select("access_token_encrypted")
        .eq("user_id", cfg.user_id)
        .maybeSingle();

      if (!tokenRow?.access_token_encrypted || tokenRow.access_token_encrypted === "pending") continue;

      let fbToken: string = tokenRow.access_token_encrypted;
      const encKey = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY;
      if (encKey) {
        try {
          const { data: decrypted } = await admin.rpc("decrypt_token", {
            encrypted_token: tokenRow.access_token_encrypted,
            key: encKey,
          });
          if (decrypted) fbToken = decrypted;
        } catch {
          // Use raw token if decryption fails
        }
      } else {
        console.warn("[cron/whatsapp-report] FACEBOOK_TOKEN_ENCRYPTION_KEY not set — using raw token");
      }

      // Fetch data and build report
      const reportData = await fetchReportData(adAccountId, fbToken, cfg.date_preset ?? "today", accountName);
      const message = buildWhatsAppMessage(reportData);

      // Send
      const result = await sendZapiMessage(cfg.phone, cfg.zapi_instance, cfg.zapi_token, message);

      if (result.ok) {
        await admin
          .from("whatsapp_reports")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("user_id", cfg.user_id);
        sent++;
      } else {
        console.error(`[cron/whatsapp-report] Failed for user ${cfg.user_id}:`, result.error);
        failed++;
      }
    } catch (e) {
      console.error(`[cron/whatsapp-report] Exception for user ${cfg.user_id}:`, e);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, total: configs.length });
}
