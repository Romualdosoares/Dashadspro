import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFacebookToken } from "@/lib/meta-token";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

// PATCH /api/meta/manage
// Body: { type: "campaign"|"adset"|"ad", id: string, action: "status"|"budget", value: string|number }
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, id, action, value } = body as {
    type: "campaign" | "adset" | "ad";
    id: string;
    action: "status" | "daily_budget" | "lifetime_budget";
    value: string | number;
  };

  if (!type || !id || !action || value === undefined) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const ALLOWED_TYPES = ["campaign", "adset", "ad"];
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  // Anúncios individuais não suportam alteração de orçamento via API Meta
  if (type === "ad" && (action === "daily_budget" || action === "lifetime_budget")) {
    return NextResponse.json({ error: "Orçamento só pode ser alterado em campanhas e conjuntos de anúncios" }, { status: 400 });
  }

  // Valida ID: deve conter apenas dígitos (IDs Meta são numéricos)
  if (!/^\d+$/.test(String(id))) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { token } = await getFacebookToken();
  if (!token) {
    console.error("[manage] Token não encontrado para user:", user.id);
    return NextResponse.json({ error: "Sessão do Facebook expirada. Faça logout e entre novamente com o Facebook." }, { status: 403 });
  }

  // Status values: ACTIVE, PAUSED, ARCHIVED
  const allowedStatuses = ["ACTIVE", "PAUSED", "ARCHIVED"];
  if (action === "status" && !allowedStatuses.includes(String(value))) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  // Budget must be a valid positive number (frontend envia em R$)
  if (action === "daily_budget" || action === "lifetime_budget") {
    const numVal = Number(value);
    if (isNaN(numVal) || numVal <= 0) {
      return NextResponse.json({ error: "Orçamento inválido. Informe um valor maior que zero." }, { status: 400 });
    }
  }

  const params = new URLSearchParams({ access_token: token });
  if (action === "status") {
    params.set("status", String(value));
  } else {
    // Meta API espera em centavos (valor em R$ × 100)
    params.set(action, String(Math.round(Number(value) * 100)));
  }

  const res = await fetch(`${GRAPH_BASE}/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const fbCode = data.error?.code;
    const fbMsg = data.error?.message ?? "Erro ao atualizar";
    let userMsg = fbMsg;
    if (fbCode === 190) userMsg = "Sessão do Facebook expirada. Faça logout e entre novamente.";
    else if (fbCode === 200) userMsg = "Sem permissão para editar esta campanha.";
    else if (fbCode === 100) userMsg = "Parâmetro inválido enviado à API do Meta.";
    console.error("[manage] Meta API error:", { id, action, fbCode, fbMsg });
    return NextResponse.json({ error: userMsg }, { status: res.status || 500 });
  }

  return NextResponse.json({ success: true, id, action, value });
}
