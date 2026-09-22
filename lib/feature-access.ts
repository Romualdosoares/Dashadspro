import { FEATURE_KEYS, type FeatureKey } from "./feature-catalog";
import { requireActiveOrganization } from "./organization-access";

type ActiveOrganization = Awaited<ReturnType<typeof requireActiveOrganization>>;

export type FeatureAccessResult =
  | {
      ok: true;
      supabase: ActiveOrganization["supabase"];
      user: NonNullable<ActiveOrganization["user"]>;
      organizationId: string;
    }
  | { ok: false; status: 401 | 403 | 409; error: string };

export async function requireOrganizationFeature(
  key: FeatureKey,
  requestedOrganizationId?: string | null,
): Promise<FeatureAccessResult> {
  const activeOrganization = await requireActiveOrganization(requestedOrganizationId);

  if (!activeOrganization.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  if (!activeOrganization.organizationId) {
    return {
      ok: false,
      status: 409,
      error: "Organization membership required",
    };
  }

  const { data, error } = await activeOrganization.supabase
    .from("organization_feature_accesses")
    .select("feature:product_features!inner(key, status)")
    .eq("organization_id", activeOrganization.organizationId)
    .eq("feature.key", key)
    .eq("feature.status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load feature access: ${error.message}`);
  }

  if (!data) {
    return { ok: false, status: 403, error: "Feature access required" };
  }

  return {
    ok: true,
    supabase: activeOrganization.supabase,
    user: activeOrganization.user,
    organizationId: activeOrganization.organizationId,
  };
}

type FeatureAccessRow = {
  feature?: { key?: unknown; status?: unknown } | null;
};

export async function listOrganizationFeatureKeys(
  requestedOrganizationId?: string | null,
): Promise<FeatureKey[]> {
  const activeOrganization = await requireActiveOrganization(requestedOrganizationId);

  if (!activeOrganization.user || !activeOrganization.organizationId) {
    return [];
  }

  const { data, error } = await activeOrganization.supabase
    .from("organization_feature_accesses")
    .select("feature:product_features!inner(key, status)")
    .eq("organization_id", activeOrganization.organizationId)
    .eq("feature.status", "active");

  if (error) {
    throw new Error(`Could not load feature access: ${error.message}`);
  }

  return ((data ?? []) as FeatureAccessRow[]).flatMap(({ feature }) => {
    if (
      typeof feature?.key !== "string" ||
      feature.status !== "active" ||
      !FEATURE_KEYS.includes(feature.key as FeatureKey)
    ) {
      return [];
    }

    return [feature.key as FeatureKey];
  });
}
