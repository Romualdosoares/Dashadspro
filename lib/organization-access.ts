import { createClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "./crm-types";

type OrganizationMembership = {
  organization_id: string;
  role: OrganizationRole;
};

export function pickActiveOrganization(
  memberships: OrganizationMembership[],
): string | null {
  return (
    memberships.find(({ role }) => role === "owner")?.organization_id ??
    memberships.find(({ role }) => role === "manager")?.organization_id ??
    memberships.find(({ role }) => role === "agent")?.organization_id ??
    null
  );
}

export async function requireActiveOrganization() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, organizationId: null };
  }

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Could not load organization memberships: ${error.message}`);
  }

  return {
    supabase,
    user,
    organizationId: pickActiveOrganization(memberships ?? []),
  };
}
