import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-guard";
import { parseCatalogFeatureInput } from "../../../../lib/feature-catalog";
import { createAdminClient } from "../../../../lib/supabase/server";

async function parseBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const { data, error } = await createAdminClient()
    .from("product_features")
    .select("id, key, name, description, status, position")
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not load features" }, { status: 500 });
  return NextResponse.json({ features: data ?? [] });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const parsed = parseCatalogFeatureInput(await parseBody(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("product_features")
    .insert(parsed.value)
    .select("id, key, name, description, status, position")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ feature: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const body = await parseBody(request);
  const parsed = parseCatalogFeatureInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const status = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>).status
    : undefined;
  if (status !== undefined && status !== "archived") {
    return NextResponse.json({ error: "Status da funcionalidade inválido" }, { status: 400 });
  }

  const values = status === "archived"
    ? { ...parsed.value, status }
    : parsed.value;
  const { data, error } = await createAdminClient()
    .from("product_features")
    .update(values)
    .eq("key", parsed.value.key)
    .select("id, key, name, description, status, position")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ feature: data });
}
