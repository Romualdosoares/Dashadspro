import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCrmPageState } from "@/lib/crm-page-state";
import CrmClient from "./CrmClient";

export default async function CrmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pageState = getCrmPageState(user);

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
