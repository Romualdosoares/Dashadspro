import { createClient, createAdminClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secret-storage";

export async function getFacebookToken(): Promise<{ token: string | null; userId: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { token: null, userId: null };

  const adminClient = createAdminClient();
  const { data: tokenRow, error } = await adminClient
    .from("facebook_tokens")
    .select("access_token_encrypted")
    .eq("user_id", user.id)
    .single();

  if (error || !tokenRow?.access_token_encrypted || tokenRow.access_token_encrypted === "pending") {
    return { token: null, userId: user.id };
  }

  try {
    const token = await decryptSecret(adminClient, tokenRow.access_token_encrypted);
    return { token, userId: user.id };
  } catch (decryptError) {
    console.error("[meta-token] Falha ao descriptografar token:", decryptError);
    return { token: null, userId: user.id };
  }
}
