import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { adAccountId, adAccountName, businessId, businessName, extraAccountIds, extraAccountNames } = body;

  // Validação obrigatória
  if (!adAccountId || typeof adAccountId !== "string" || adAccountId.trim() === "") {
    return NextResponse.json({ error: "adAccountId é obrigatório" }, { status: 400 });
  }
  if (!adAccountName || typeof adAccountName !== "string") {
    return NextResponse.json({ error: "adAccountName é obrigatório" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // 1. Persiste a conta selecionada na tabela ad_accounts
  const { error: upsertErr } = await adminClient.from("ad_accounts").upsert(
    {
      user_id: user.id,
      meta_account_id: adAccountId,
      meta_account_name: adAccountName,
      business_id: businessId ?? null,
      business_name: businessName ?? null,
      is_selected: true,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,meta_account_id" }
  );

  if (upsertErr) {
    console.error("[select-account] upsert error:", upsertErr.code, upsertErr.message, upsertErr.details);
    // Não bloqueia o fluxo por erro de DB — o essencial é o user_metadata
  }

  // Desmarca is_selected das outras contas do usuário (best-effort)
  await adminClient
    .from("ad_accounts")
    .update({ is_selected: false })
    .eq("user_id", user.id)
    .neq("meta_account_id", adAccountId);

  // 2. Salva nos user_metadata para acesso rápido no middleware (sem query ao banco)
  const { error: metaErr } = await supabase.auth.updateUser({
    data: {
      selected_ad_account_id: adAccountId,
      selected_ad_account_name: adAccountName,
      selected_business_name: businessName ?? null,
      extra_account_ids: Array.isArray(extraAccountIds) ? extraAccountIds : [],
      extra_account_names: Array.isArray(extraAccountNames) ? extraAccountNames : [],
    },
  });

  if (metaErr) {
    console.error("[select-account] updateUser error:", metaErr.message);
    return NextResponse.json({ error: "Erro ao atualizar sessão. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
