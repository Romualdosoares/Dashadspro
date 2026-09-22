import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/admin-guard";
import { FEATURE_KEYS, type FeatureKey } from "../../../../../../lib/feature-catalog";
import { createAdminClient } from "../../../../../../lib/supabase/server";

type FeatureGrantRow = { feature?: { key?: unknown } | null };

async function parseBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parseFeatureKeys(body: unknown): { ok: true; keys: FeatureKey[] } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || !Array.isArray((body as { featureKeys?: unknown }).featureKeys)) {
    return { ok: false, error: "Feature keys inválidos" };
  }

  const keys = (body as { featureKeys: unknown[] }).featureKeys;
  if (keys.some((key) => typeof key !== "string" || !FEATURE_KEYS.includes(key as FeatureKey))) {
    return { ok: false, error: "Feature não suportada" };
  }
  if (new Set(keys).size !== keys.length) {
    return { ok: false, error: "Feature keys duplicados" };
  }

  return { ok: true, keys: keys as FeatureKey[] };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { response } = await requireAdmin();
  if (response) return response;

  const { organizationId } = await params;
  const admin = createAdminClient();
  const [catalogResult, grantsResult] = await Promise.all([
    admin
      .from("product_features")
      .select("id, key, name, description, status, position")
      .order("position", { ascending: true }),
    admin
      .from("organization_feature_accesses")
      .select("feature:product_features!inner(key)")
      .eq("organization_id", organizationId),
  ]);

  if (catalogResult.error || grantsResult.error) {
    return NextResponse.json({ error: "Could not load organization features" }, { status: 500 });
  }

  const enabledFeatureKeys = ((grantsResult.data ?? []) as FeatureGrantRow[]).flatMap(({ feature }) =>
    typeof feature?.key === "string" && FEATURE_KEYS.includes(feature.key as FeatureKey)
      ? [feature.key]
      : [],
  );
  return NextResponse.json({ features: catalogResult.data ?? [], enabledFeatureKeys });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { response } = await requireAdmin();
  if (response) return response;

  const parsed = parseFeatureKeys(await parseBody(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { organizationId } = await params;
  const admin = createAdminClient();
  const { data: catalogFeatures, error: catalogError } = parsed.keys.length === 0
    ? { data: [], error: null }
    : await admin
      .from("product_features")
      .select("id, key")
      .in("key", parsed.keys);

  if (catalogError || (catalogFeatures?.length ?? 0) !== parsed.keys.length) {
    return NextResponse.json({ error: "Feature não suportada" }, { status: 400 });
  }

  const { error: deleteError } = await admin
    .from("organization_feature_accesses")
    .delete()
    .eq("organization_id", organizationId);
  if (deleteError) {
    return NextResponse.json({ error: "Could not replace organization features" }, { status: 500 });
  }

  if (catalogFeatures && catalogFeatures.length > 0) {
    const { error: insertError } = await admin
      .from("organization_feature_accesses")
      .insert(catalogFeatures.map((feature) => ({
        organization_id: organizationId,
        feature_id: feature.id,
      })));
    if (insertError) {
      return NextResponse.json({ error: "Could not replace organization features" }, { status: 500 });
    }
  }

  return NextResponse.json({ organizationId, featureKeys: parsed.keys });
}
