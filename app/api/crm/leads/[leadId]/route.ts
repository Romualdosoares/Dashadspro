import { NextResponse } from "next/server";
import { requireActiveOrganization } from "../../../../../lib/organization-access";
import { validateLeadStageUpdate } from "../../../../../lib/crm-validation";

type RouteContext = { params: Promise<{ leadId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const requestedOrganizationId = new URL(request.url).searchParams.get("organization_id");
    const { supabase, user, organizationId } = await requireActiveOrganization(requestedOrganizationId);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization membership required" },
        { status: 409 },
      );
    }

    const { leadId } = await params;
    if (!validateLeadStageUpdate(leadId).ok) {
      return NextResponse.json({ error: "Lead invalido" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const stageValidation = validateLeadStageUpdate(
      body && typeof body === "object" ? (body as { stage_id?: unknown }).stage_id : undefined,
    );
    if (!stageValidation.ok) {
      return NextResponse.json({ error: stageValidation.error }, { status: 400 });
    }

    const { data: stage, error: stageError } = await supabase
      .from("crm_pipeline_stages")
      .select("id")
      .eq("id", stageValidation.value)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (stageError) {
      return NextResponse.json({ error: "Could not load pipeline stage" }, { status: 500 });
    }
    if (!stage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const { data: lead, error: updateError } = await supabase
      .from("crm_leads")
      .update({ stage_id: stageValidation.value })
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .select("id, stage_id")
      .maybeSingle();
    if (updateError) {
      return NextResponse.json({ error: "Could not update CRM lead" }, { status: 500 });
    }
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch {
    return NextResponse.json({ error: "Could not update CRM lead" }, { status: 500 });
  }
}
