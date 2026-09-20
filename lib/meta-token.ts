import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Retorna o Facebook access token do usuário autenticado.
 * Estratégia em cascata:
 * 1. Tabela facebook_tokens — tenta descriptografar; se RPC falhar usa o valor bruto
 * 2. user_metadata.facebook_access_token (fallback legacy)
 *
 * Nota: provider_token da sessão Supabase não é persistido em cookies SSR,
 * portanto não é utilizado aqui (sempre null em Route Handlers).
 */
export async function getFacebookToken(): Promise<{ token: string | null; userId: string | null }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { token: null, userId: null };

  // 1. Tabela facebook_tokens (fonte primária)
  const adminClient = createAdminClient();
  const { data: tokenRow } = await adminClient
    .from("facebook_tokens")
    .select("access_token_encrypted")
    .eq("user_id", user.id)
    .single();

  if (tokenRow?.access_token_encrypted && tokenRow.access_token_encrypted !== "pending") {
    const raw = tokenRow.access_token_encrypted;
    // Tenta descriptografar via RPC
    try {
      const { data: decrypted, error: rpcErr } = await adminClient.rpc("decrypt_token", {
        encrypted_token: raw,
        key: process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY!,
      });
      // RPC ok e retornou valor diferente do input = descriptografou com sucesso
      if (!rpcErr && decrypted && decrypted !== raw) {
        return { token: decrypted, userId: user.id };
      }
    } catch {
      // RPC indisponível — usa valor bruto abaixo
    }
    // Fallback: valor bruto (plain-text quando encrypt falhou no callback)
    return { token: raw, userId: user.id };
  }

  // 2. Fallback legacy via user_metadata
  const legacyToken = (user.user_metadata?.facebook_access_token as string) ?? null;
  return { token: legacyToken, userId: user.id };
}
