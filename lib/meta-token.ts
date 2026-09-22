import { createClient, createAdminClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secret-storage";

type TokenUser = { id: string };

export async function getFacebookToken(
  authenticatedUser?: TokenUser | null,
): Promise<{ token: string | null; userId: string | null }> {
  let user = authenticatedUser;
  if (user === undefined) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }
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
