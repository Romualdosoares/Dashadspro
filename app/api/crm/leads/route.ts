import { NextResponse } from "next/server";
import { requireActiveOrganization } from "../../../../lib/organization-access";
import { validateLeadCreate } from "../../../../lib/crm-validation";

function accessError(user: unknown, organizationId: string | null) {
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization membership required" },
      { status: 409 },
    );
  }
  return null;
}

function requestedOrganizationId(request?: Request): string | null {
  return request ? new URL(request.url).searchParams.get("organization_id") : null;
}

export async function GET(request?: Request) {
  try {
    const { supabase, user, organizationId } = await requireActiveOrganization(requestedOrganizationId(request));
    const errorResponse = accessError(user, organizationId);
    if (errorResponse) return errorResponse;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization membership required" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("crm_leads")
      .select("id, contact_id, stage_id, source, status, created_at, updated_at, contact:crm_contacts!crm_leads_organization_id_contact_id_fkey(id, name, phone, email), stage:crm_pipeline_stages!crm_leads_organization_id_stage_id_fkey(id, name, position)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Could not load CRM leads" }, { status: 500 });
    }

    const leads = (data ?? []).map((lead) => {
      const contact = Array.isArray(lead.contact) ? lead.contact[0] : lead.contact;
      return {
        id: lead.id,
        contact_id: lead.contact_id,
        stage_id: lead.stage_id,
        source: lead.source,
        status: lead.status,
        contact_name: contact?.name ?? "",
        contact_phone: contact?.phone ?? null,
        contact_email: contact?.email ?? null,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      };
    });

    return NextResponse.json({ leads });
  } catch {
    return NextResponse.json({ error: "Could not load CRM leads" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, organizationId } = await requireActiveOrganization(requestedOrganizationId(request));
    const errorResponse = accessError(user, organizationId);
    if (errorResponse) return errorResponse;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization membership required" },
        { status: 409 },
      );
    }

    const input = await request.json().catch(() => null);
    const validation = validateLeadCreate(input);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data, error: createLeadError } = await supabase.rpc("create_crm_lead", {
      target_organization_id: organizationId,
      contact_name: validation.value.name,
      contact_phone: validation.value.phone,
      contact_email: validation.value.email,
      lead_source: validation.value.source,
    });
    if (createLeadError?.code === "P0001" && createLeadError.message === "Pipeline stage required") {
      return NextResponse.json({ error: "Pipeline stage required" }, { status: 409 });
    }
    if (createLeadError?.code === "23505") {
      return NextResponse.json({ error: "Contact identities conflict" }, { status: 409 });
    }
    const lead = data?.[0];
    if (createLeadError || !lead) {
      return NextResponse.json({ error: "Could not create CRM lead" }, { status: 500 });
    }

    return NextResponse.json({
      lead: { id: lead.lead_id, contact_id: lead.contact_id, stage_id: lead.stage_id },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create CRM lead" }, { status: 500 });
  }
}
