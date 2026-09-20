import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const baseUrl = origin;

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/login?error=oauth_denied`);
  }

  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    // Collect cookies set during session exchange, then apply to the final redirect response
    const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return allCookies;
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options });
            });
          },
        },
      }
    );

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !data?.session) {
      const msg = exchangeError?.message ?? "no_session";
      return NextResponse.redirect(`${baseUrl}/login?error=token_exchange&msg=${encodeURIComponent(msg)}`);
    }

    const { session, user } = data;
    const isFacebook = user.app_metadata?.provider === "facebook";

    // Salva token se disponível; caso contrário, salva placeholder para identificar o usuário
    if (isFacebook) {
      try {
        const adminClient = createAdminClient();
        const encKey = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY!;

        // Só atualiza o token se veio um novo na sessão (evita sobrescrever com "pending")
        if (session.provider_token) {
          let tokenToStore = session.provider_token; // fallback: plain-text

          try {
            const { data: encryptedData, error: encErr } = await adminClient.rpc("encrypt_token", {
              token: session.provider_token,
              key: encKey,
            });
            if (!encErr && encryptedData) {
              tokenToStore = encryptedData;
            }
          } catch {
            // encrypt_token RPC indisponível — salva plain-text como fallback
          }

          await adminClient.from("facebook_tokens").upsert(
            {
              user_id: user.id,
              facebook_user_id: user.user_metadata?.provider_id ?? user.id,
              access_token_encrypted: tokenToStore,
              scopes: ["email", "public_profile", "ads_read", "ads_management", "business_management"],
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        } else {
          // Sem token novo — garante que a linha existe apenas se não existir ainda
          const { data: existing } = await adminClient
            .from("facebook_tokens")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!existing) {
            await adminClient.from("facebook_tokens").insert({
              user_id: user.id,
              facebook_user_id: user.user_metadata?.provider_id ?? user.id,
              access_token_encrypted: "pending",
              scopes: [],
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error("Failed to save Facebook token:", err);
      }

      // Só vai para /select-account se ainda não tem conta selecionada
      const hasAccount = !!user.user_metadata?.selected_ad_account_id;
      const redirectTo = hasAccount ? `${baseUrl}/dashboard` : `${baseUrl}/select-account`;
      const response = NextResponse.redirect(redirectTo);
      pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    const response = NextResponse.redirect(`${baseUrl}/dashboard`);
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  } catch (err) {
    console.error("Callback fatal error:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=token_exchange&msg=fatal_error`);
  }
}
