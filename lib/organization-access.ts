import { createClient } from "@/lib/supabase/server";
import { getPlatformRole } from "./auth-role";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requireActiveOrganization(requestedOrganizationId?: string | null) {
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

  const fallbackOrganizationId = pickActiveOrganization(memberships ?? []);
  if (getPlatformRole(user) !== "admin" || requestedOrganizationId == null) {
    return {
      supabase,
      user,
      organizationId: fallbackOrganizationId,
    };
  }

  if (!UUID.test(requestedOrganizationId)) {
    return {
      supabase,
      user,
      organizationId: null,
    };
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", requestedOrganizationId)
    .maybeSingle();
  if (organizationError) {
    throw new Error(`Could not load requested organization: ${organizationError.message}`);
  }

  return {
    supabase,
    user,
    organizationId: organization?.id ?? null,
  };
}
