import { NextResponse } from "next/server";
import { getClientNavigation } from "../../../../lib/client-navigation";
import { listOrganizationFeatureKeys } from "../../../../lib/feature-access";
import { requireActiveOrganization } from "../../../../lib/organization-access";

export async function GET(_request: Request) {
  try {
    const { user, organizationId } = await requireActiveOrganization();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!organizationId) {
      return NextResponse.json({ error: "Organization membership required" }, { status: 409 });
    }

    const featureKeys = await listOrganizationFeatureKeys();
    return NextResponse.json({
      organizationId,
      features: getClientNavigation(featureKeys),
    });
  } catch {
    return NextResponse.json({ error: "Could not load feature context" }, { status: 500 });
  }
}
