import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET — carrega preferências: tabela user_preferences → fallback user_metadata
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Tenta tabela user_preferences primeiro
  const admin = createAdminClient();
  const { data, error: fetchErr } = await admin
    .from("user_preferences")
    .select("columns, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!fetchErr && data?.columns && data.columns.length > 0) {
    return NextResponse.json({
      preferences: { columns: data.columns, updated_at: data.updated_at ?? null },
    });
  }

  if (fetchErr) {
    console.error("[preferences GET] table error:", fetchErr.code, fetchErr.message);
  }

  // Fallback: user_metadata (sempre disponível)
  const metaColumns = user.user_metadata?.dashboard_columns;
  if (Array.isArray(metaColumns) && metaColumns.length > 0) {
    return NextResponse.json({ preferences: { columns: metaColumns } });
  }

  return NextResponse.json({ preferences: { columns: [] } });
}

// PATCH — salva preferências: tabela user_preferences + user_metadata como fallback
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const columns: string[] = Array.isArray(body.columns) ? body.columns : [];

  // Salva sempre no user_metadata (fallback confiável, sem dependência de tabela)
  const { error: metaErr } = await supabase.auth.updateUser({
    data: { dashboard_columns: columns },
  });
  if (metaErr) {
    console.error("[preferences PATCH] updateUser error:", metaErr.message);
    return NextResponse.json({ error: metaErr.message }, { status: 500 });
  }

  // Tenta salvar também na tabela user_preferences (best-effort)
  const admin = createAdminClient();
  const { error: upsertError } = await admin
    .from("user_preferences")
    .upsert(
      { user_id: user.id, columns, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (upsertError) {
    console.warn("[preferences PATCH] table upsert failed (non-fatal):", upsertError.code, upsertError.message);
    // Não retorna erro — user_metadata já foi salvo com sucesso
  }

  return NextResponse.json({ preferences: { columns } });
}
