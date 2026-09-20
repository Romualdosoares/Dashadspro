import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not logged in" }, { status: 401 });
  }

  // Verifica token na tabela
  const adminClient = createAdminClient();
  const { data: tokenRow, error: tokenError } = await adminClient
    .from("facebook_tokens")
    .select("facebook_user_id, updated_at, scopes, access_token_encrypted")
    .eq("user_id", user.id)
    .single();

  // Apenas em desenvolvimento para evitar exposição de dados em produção
  const isDev = process.env.NODE_ENV === "development";

  return NextResponse.json({
    user_id: isDev ? user.id : "[redacted]",
    provider: user.app_metadata?.provider,
    provider_token_in_session: !!session?.provider_token,
    token_in_db: !!tokenRow,
    token_db_error: tokenError?.message ?? null,
    // Nunca expõe o token, nem parcialmente
    token_has_value: !!(tokenRow?.access_token_encrypted && tokenRow.access_token_encrypted !== "pending"),
    token_is_pending: tokenRow?.access_token_encrypted === "pending",
    token_updated_at: tokenRow?.updated_at ?? null,
  });
}
