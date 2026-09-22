import { redirect } from "next/navigation";
import { getPlatformRole } from "@/lib/auth-role";
import FeatureAccessDenied from "@/components/FeatureAccessDenied";
import { requireOrganizationFeature } from "@/lib/feature-access";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const access = await requireOrganizationFeature("dashboard_ads");
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return <FeatureAccessDenied error={access.error} />;
  }
  const { user } = access;

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
