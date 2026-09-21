import { createClient } from "@/lib/supabase/server";
import type { OrganizationRole } from "./crm-types";

type OrganizationMembership = {
  organization_id: string;
  role: OrganizationRole;
};

export function pickActiveOrganization(
  memberships: OrganizationMembership[],
): string | null {
  for (const role of ["owner", "manager", "agent"] as const) {
    const organizationId = memberships
      .filter((membership) => membership.role === role)
      .map((membership) => membership.organization_id)
      .sort()[0];

    if (organizationId !== undefined) {
      return organizationId;
    }
  }

  return null;
}

export async function requireActiveOrganization() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw new Error("Não foi possível validar autenticação", {
      cause: authError,
    });
  }

  if (!user) {
    return { supabase, user: null, organizationId: null };
  }

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("organization_id", { ascending: true });

  if (error) {
    throw new Error(`Could not load organization memberships: ${error.message}`);
  }

  return {
    supabase,
    user,
    organizationId: pickActiveOrganization(memberships ?? []),
  };
}
