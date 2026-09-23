import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/secret-storage";
import { cookies } from "next/headers";
import { resolveSiteOrigin } from "@/lib/site-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const baseUrl = resolveSiteOrigin(request.url);

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/login?error=oauth_denied`);
  }

  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => allCookies,
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options });
            });
          },
        },
      },
    );

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError || !data?.session) {
      const msg = exchangeError?.message ?? "no_session";
      return NextResponse.redirect(`${baseUrl}/login?error=token_exchange&msg=${encodeURIComponent(msg)}`);
    }

    const { session, user } = data;
    const isFacebook = Boolean(session.provider_token) || user.app_metadata?.provider === "facebook";

    if (isFacebook) {
      const adminClient = createAdminClient();
      if (session.provider_token) {
        const encryptedToken = await encryptSecret(adminClient, session.provider_token);
        const { error: saveError } = await adminClient.from("facebook_tokens").upsert(
          {
            user_id: user.id,
            facebook_user_id: user.user_metadata?.provider_id ?? user.id,
            access_token_encrypted: encryptedToken,
            scopes: ["email", "public_profile", "ads_read", "ads_management", "business_management"],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (saveError) throw saveError;
      } else {
        const { data: existing, error: readError } = await adminClient
          .from("facebook_tokens")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (readError) throw readError;
        if (!existing) {
          const { error: insertError } = await adminClient.from("facebook_tokens").insert({
            user_id: user.id,
            facebook_user_id: user.user_metadata?.provider_id ?? user.id,
            access_token_encrypted: "pending",
            scopes: [],
            updated_at: new Date().toISOString(),
          });
          if (insertError) throw insertError;
        }
      }

      const hasAccount = Boolean(user.user_metadata?.selected_ad_account_id);
      const response = NextResponse.redirect(`${baseUrl}${hasAccount ? "/dashboard" : "/select-account"}`);
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
