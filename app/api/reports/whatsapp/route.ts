import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireOrganizationFeature } from "../../../../lib/feature-access";
import { getFacebookToken } from "@/lib/meta-token";
import { fetchReportData, buildWhatsAppMessage, sendZapiMessage } from "@/lib/whatsapp-report";
import { decryptSecret } from "@/lib/secret-storage";

const DATE_PRESETS = new Set(["today", "yesterday", "last_3d", "last_7d", "last_30d"]);

export async function POST(request: Request) {
  const requestedOrganizationId = new URL(request.url).searchParams.get("organization_id");
  const access = await requireOrganizationFeature("dashboard_ads", requestedOrganizationId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { supabase, user } = access;

  // Load user's WhatsApp config
  const { data: config, error: configError } = await supabase
    .from("whatsapp_reports")
    .select("phone,zapi_instance,zapi_token,date_preset")
    .eq("user_id", user.id)
    .maybeSingle();

  if (configError) return NextResponse.json({ error: configError.message }, { status: 500 });

  // Only allow overriding date_preset from body — phone and credentials always come from DB
  const body = await request.json().catch(() => ({}));
  const phone = config?.phone;
  const zapiInstance = config?.zapi_instance;
  const encryptedZapiToken = config?.zapi_token;
  const datePreset = String(body.date_preset ?? config?.date_preset ?? "today");

  if (!phone || !zapiInstance || !encryptedZapiToken) {
    return NextResponse.json({ error: "Configuração incompleta. Configure telefone e Z-API antes de enviar." }, { status: 400 });
  }
  if (!DATE_PRESETS.has(datePreset)) {
    return NextResponse.json({ error: "Periodo invalido" }, { status: 400 });
  }

  let zapiToken: string;
  try {
    zapiToken = await decryptSecret(createAdminClient(), encryptedZapiToken);
  } catch (error) {
    console.error("[reports/whatsapp] Falha ao descriptografar token Z-API:", error);
    return NextResponse.json({ error: "Credencial Z-API invalida. Salve o token novamente." }, { status: 500 });
  }

  const adAccountId = user.user_metadata?.selected_ad_account_id;
  if (!adAccountId) {
    return NextResponse.json({ error: "Nenhuma conta de anúncios selecionada" }, { status: 400 });
  }

  const { token } = await getFacebookToken(user);
  if (!token) {
    return NextResponse.json({ error: "Token do Facebook não disponível" }, { status: 403 });
  }

  const accountName = user.user_metadata?.selected_ad_account_name as string | undefined;

  // Fetch data and build message
  const reportData = await fetchReportData(adAccountId, token, datePreset, accountName);
  const message = buildWhatsAppMessage(reportData);

  // Send via Z-API
  const result = await sendZapiMessage(phone, zapiInstance, zapiToken, message);

  if (!result.ok) {
    return NextResponse.json({ error: `Falha ao enviar WhatsApp: ${result.error}` }, { status: 502 });
  }

  // Update last_sent_at
  await supabase
    .from("whatsapp_reports")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, message });
}
