import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};

  return NextResponse.json({
    session: {
      type: appMeta.provider === "facebook" ? "facebook" : "local",
      userId: user.id,
      email: user.email,
      name: meta.full_name ?? meta.name ?? user.email,
      avatarUrl: meta.avatar_url ?? null,
      selectedAdAccountId: meta.selected_ad_account_id ?? null,
      selectedAdAccountName: meta.selected_ad_account_name ?? null,
      selectedBusinessName: meta.selected_business_name ?? null,
    },
  });
}
