import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("whatsapp_reports")
    .select("id,phone,zapi_instance,zapi_token,schedule,schedule_hours,schedule_timezone,date_preset,enabled,last_sent_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ config: data ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { phone, zapi_instance, zapi_token, schedule, schedule_hours, schedule_timezone, date_preset, enabled } = body;

  // Valida campos obrigatórios quando enabled=true
  if (enabled) {
    if (!phone || typeof phone !== "string" || !/^\+?\d{8,15}$/.test(phone.replace(/[\s\-().]/g, ""))) {
      return NextResponse.json({ error: "Telefone inválido. Use o formato com DDD (ex: 11987654321)" }, { status: 400 });
    }
    if (!zapi_instance || typeof zapi_instance !== "string" || zapi_instance.trim() === "") {
      return NextResponse.json({ error: "ID da instância Z-API é obrigatório" }, { status: 400 });
    }
    if (!zapi_token || typeof zapi_token !== "string" || zapi_token.trim() === "") {
      return NextResponse.json({ error: "Token Z-API é obrigatório" }, { status: 400 });
    }
  }

  const payload = {
    user_id: user.id,
    phone: phone ?? "",
    zapi_instance: zapi_instance ?? "",
    zapi_token: zapi_token ?? "",
    schedule: schedule ?? "manual",
    schedule_hours: Array.isArray(schedule_hours) ? schedule_hours : [11],
    schedule_timezone: schedule_timezone ?? "America/Sao_Paulo",
    date_preset: date_preset ?? "today",
    enabled: enabled ?? false,
  };

  const { data, error } = await supabase
    .from("whatsapp_reports")
    .upsert(payload, { onConflict: "user_id" })
    .select("id,phone,zapi_instance,zapi_token,schedule,schedule_hours,schedule_timezone,date_preset,enabled,last_sent_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ config: data });
}
