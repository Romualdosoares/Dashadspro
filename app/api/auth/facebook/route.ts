import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const baseUrl = new URL(request.url).origin;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${baseUrl}/api/auth/callback`,
      scopes: "email,public_profile,ads_read,ads_management,business_management",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login?error=facebook_init", request.url));
  }

  return NextResponse.redirect(data.url);
}
