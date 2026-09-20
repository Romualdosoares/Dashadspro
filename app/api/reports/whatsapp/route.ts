import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFacebookToken } from "@/lib/meta-token";
import { fetchReportData, buildWhatsAppMessage, sendZapiMessage } from "@/lib/whatsapp-report";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const zapiToken = config?.zapi_token;
  const datePreset = body.date_preset ?? config?.date_preset ?? "today";

  if (!phone || !zapiInstance || !zapiToken) {
    return NextResponse.json({ error: "Configuração incompleta. Configure telefone e Z-API antes de enviar." }, { status: 400 });
  }

  const adAccountId = user.user_metadata?.selected_ad_account_id;
  if (!adAccountId) {
    return NextResponse.json({ error: "Nenhuma conta de anúncios selecionada" }, { status: 400 });
  }

  const { token } = await getFacebookToken();
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
