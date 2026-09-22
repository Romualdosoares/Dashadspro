import { redirect } from "next/navigation";
import { getPlatformRole } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const meta = user.user_metadata ?? {};
  const isFacebook = user.app_metadata?.provider === "facebook";

  // Usuário Facebook sem conta selecionada → redireciona
  if (isFacebook && !meta.selected_ad_account_id) {
    redirect("/select-account");
  }

  const accountInfo = {
    adAccountId: meta.selected_ad_account_id ?? null,
    adAccountName: meta.selected_ad_account_name ?? (isFacebook ? "" : "Demo Account"),
    userName: meta.full_name ?? meta.name ?? user.email ?? "Usuário",
    businessName: meta.selected_business_name ?? "",
    role: getPlatformRole(user),
    extraAccountIds: Array.isArray(meta.extra_account_ids) ? (meta.extra_account_ids as string[]) : [],
    extraAccountNames: Array.isArray(meta.extra_account_names) ? (meta.extra_account_names as string[]) : [],
  };

  return <DashboardClient accountInfo={accountInfo} />;
}
