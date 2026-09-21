import { NextResponse } from "next/server";
import { requireActiveOrganization } from "../../../../lib/organization-access";

export async function GET() {
  try {
    const { supabase, user, organizationId } = await requireActiveOrganization();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization membership required" },
        { status: 409 },
      );
    }

    const [membershipResult, organizationResult, stagesResult] = await Promise.all([
      supabase
        .from("organization_memberships")
        .select("organization_id, role")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("id, name, slug")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("crm_pipeline_stages")
        .select("id, name, position")
        .eq("organization_id", organizationId)
        .order("position", { ascending: true }),
    ]);

    if (membershipResult.error || organizationResult.error || stagesResult.error) {
      return NextResponse.json({ error: "Could not load CRM context" }, { status: 500 });
    }

    if (!membershipResult.data || !organizationResult.data) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const metadata = user.user_metadata ?? {};
    return NextResponse.json({
      organization: organizationResult.data,
      membership: {
        organizationId: membershipResult.data.organization_id,
        role: membershipResult.data.role,
      },
      stages: stagesResult.data ?? [],
      user: {
        id: user.id,
        email: user.email ?? null,
        name: metadata.full_name ?? metadata.name ?? user.email ?? null,
        avatarUrl: metadata.avatar_url ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not load CRM context" }, { status: 500 });
  }
}
