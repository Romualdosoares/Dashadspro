import { NextResponse } from "next/server";
import { requireOrganizationFeature } from "../../../../lib/feature-access";
import { getFacebookToken } from "@/lib/meta-token";
import { GRAPH_BASE } from "@/lib/meta-config";
import { validateManagePayload } from "@/lib/meta-validation";

export async function PATCH(request: Request) {
  const requestedOrganizationId = new URL(request.url).searchParams.get("organization_id");
  const access = await requireOrganizationFeature("dashboard_ads", requestedOrganizationId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { user } = access;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const validation = validateManagePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { id, action, value } = validation.value;

  const { token } = await getFacebookToken(user);
  if (!token) {
    console.error("[manage] Token nao encontrado para user:", user.id);
    return NextResponse.json(
      { error: "Sessao do Facebook expirada. Faca logout e entre novamente com o Facebook." },
      { status: 403 },
    );
  }

  const params = new URLSearchParams({ access_token: token });
  if (action === "status") {
    params.set("status", String(value));
  } else {
    params.set(action, String(Math.round(Number(value) * 100)));
  }

  const res = await fetch(`${GRAPH_BASE}/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();

  if (!res.ok || data.error) {
    const fbCode = data.error?.code;
    const fbMsg = data.error?.message ?? "Erro ao atualizar";
    let userMsg = fbMsg;
    if (fbCode === 190) userMsg = "Sessao do Facebook expirada. Faca logout e entre novamente.";
    else if (fbCode === 200) userMsg = "Sem permissao para editar esta campanha.";
    else if (fbCode === 100) userMsg = "Parametro invalido enviado a API do Meta.";
    console.error("[manage] Meta API error:", { id, action, fbCode, fbMsg });
    return NextResponse.json({ error: userMsg }, { status: res.status || 500 });
  }

  return NextResponse.json({ success: true, id, action, value });
}
