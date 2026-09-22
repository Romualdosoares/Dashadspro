import { redirect } from "next/navigation";
import FeatureAccessDenied from "@/components/FeatureAccessDenied";
import { requireOrganizationFeature } from "@/lib/feature-access";
import { getCrmPageState } from "@/lib/crm-page-state";
import CrmClient from "./CrmClient";

export default async function CrmPage() {
  const access = await requireOrganizationFeature("crm");
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return <FeatureAccessDenied error={access.error} />;
  }

  const pageState = getCrmPageState(access.user);

  if (pageState.kind === "redirect") {
    redirect(pageState.href);
  }

  return (
    <CrmClient
      userName={pageState.userName}
      userEmail={pageState.userEmail}
    />
  );
}
