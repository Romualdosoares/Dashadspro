import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CrmClient from "./CrmClient";

export default async function CrmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const metadata = user.user_metadata ?? {};
  const userName = [metadata.full_name, metadata.name, user.email].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  )?.trim() ?? "Usuário";

  return (
    <CrmClient
      userName={userName}
      userEmail={typeof user.email === "string" ? user.email : null}
    />
  );
}
