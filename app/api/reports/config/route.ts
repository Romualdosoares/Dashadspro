import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireOrganizationFeature } from "../../../../lib/feature-access";
import { encryptSecret } from "@/lib/secret-storage";
import { normalizeBrazilianPhone } from "@/lib/report-schedule";

const SAFE_FIELDS = "id,phone,zapi_instance,schedule,schedule_hours,schedule_timezone,date_preset,enabled,last_sent_at";
const SCHEDULES = new Set(["manual", "daily", "weekly"]);
const DATE_PRESETS = new Set(["today", "yesterday", "last_3d", "last_7d", "last_30d"]);

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const requestedOrganizationId = new URL(request.url).searchParams.get("organization_id");
  const access = await requireOrganizationFeature("dashboard_ads", requestedOrganizationId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { supabase, user } = access;

  const { data, error } = await supabase
    .from("whatsapp_reports")
    .select(`${SAFE_FIELDS},zapi_token`)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ config: null });

  const { zapi_token, ...safeConfig } = data;
  return NextResponse.json({
    config: { ...safeConfig, zapi_token: "", zapi_token_configured: Boolean(zapi_token) },
  });
}

export async function POST(request: Request) {
  const requestedOrganizationId = new URL(request.url).searchParams.get("organization_id");
  const access = await requireOrganizationFeature("dashboard_ads", requestedOrganizationId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { user } = access;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const rawPhone = String(body.phone ?? "");
  let phone = "";
  if (rawPhone) {
    try {
      phone = normalizeBrazilianPhone(rawPhone);
    } catch {
      return NextResponse.json({ error: "Telefone invalido. Use DDD e numero." }, { status: 400 });
    }
  }
  const instance = String(body.zapi_instance ?? "").trim();
  const newToken = String(body.zapi_token ?? "").trim();
  const schedule = String(body.schedule ?? "manual");
  const timezone = String(body.schedule_timezone ?? "America/Sao_Paulo");
  const datePreset = String(body.date_preset ?? "today");
  const enabled = body.enabled === true;
  const hours = Array.isArray(body.schedule_hours)
    ? [...new Set(body.schedule_hours.map(Number))]
    : [11];

  if (instance && !/^[A-Za-z0-9_-]{3,128}$/.test(instance)) {
    return NextResponse.json({ error: "ID da instancia Z-API invalido" }, { status: 400 });
  }
  if (!SCHEDULES.has(schedule) || !DATE_PRESETS.has(datePreset) || !validTimeZone(timezone)) {
    return NextResponse.json({ error: "Configuracao de agendamento invalida" }, { status: 400 });
  }
  if (hours.length > 4 || hours.some((hour) => !Number.isInteger(hour) || hour < 0 || hour > 23)) {
    return NextResponse.json({ error: "Horarios de envio invalidos" }, { status: 400 });
  }
  if (enabled && (!phone || !instance || (schedule !== "manual" && hours.length === 0))) {
    return NextResponse.json({ error: "Preencha telefone, instancia e horarios antes de ativar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("whatsapp_reports")
    .select("zapi_token")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  let encryptedToken = existing?.zapi_token ?? "";
  if (newToken) {
    try {
      encryptedToken = await encryptSecret(admin, newToken);
    } catch (error) {
      console.error("[reports/config] Falha ao criptografar token Z-API:", error);
      return NextResponse.json({ error: "Nao foi possivel proteger o token Z-API" }, { status: 500 });
    }
  }
  if (enabled && !encryptedToken) {
    return NextResponse.json({ error: "Token Z-API obrigatorio" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("whatsapp_reports")
    .upsert({
      user_id: user.id,
      phone,
      zapi_instance: instance,
      zapi_token: encryptedToken,
      schedule,
      schedule_hours: hours,
      schedule_timezone: timezone,
      date_preset: datePreset,
      enabled,
    }, { onConflict: "user_id" })
    .select(SAFE_FIELDS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    config: { ...data, zapi_token: "", zapi_token_configured: Boolean(encryptedToken) },
  });
}
