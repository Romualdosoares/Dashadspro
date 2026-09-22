import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/admin-guard";
import { createAdminClient } from "../../../../lib/supabase/server";

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  organization_memberships?: Array<{ count?: number | null }> | null;
};

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("id, name, slug, organization_memberships(count)")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not load organizations" }, { status: 500 });

  const organizations = ((data ?? []) as OrganizationRow[]).map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    memberCount: organization.organization_memberships?.[0]?.count ?? 0,
  }));
  return NextResponse.json({ organizations });
}
