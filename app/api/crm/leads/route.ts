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

export async function GET() {
  try {
    const { supabase, user, organizationId } = await requireActiveOrganization();
    const errorResponse = accessError(user, organizationId);
    if (errorResponse) return errorResponse;

    const { data, error } = await supabase
      .from("crm_leads")
      .select("id, contact_id, stage_id, source, status, created_at, contact:crm_contacts!crm_leads_organization_id_contact_id_fkey(id, name, phone, email), stage:crm_pipeline_stages!crm_leads_organization_id_stage_id_fkey(id, name, position)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Could not load CRM leads" }, { status: 500 });
    }

    return NextResponse.json({ leads: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Could not load CRM leads" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, organizationId } = await requireActiveOrganization();
    const errorResponse = accessError(user, organizationId);
    if (errorResponse) return errorResponse;

    const input = await request.json().catch(() => null);
    const validation = validateLeadCreate(input);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data: stages, error: stagesError } = await supabase
      .from("crm_pipeline_stages")
      .select("id")
      .eq("organization_id", organizationId)
      .order("position", { ascending: true })
      .limit(1);
    if (stagesError) {
      return NextResponse.json({ error: "Could not load pipeline stages" }, { status: 500 });
    }

    const stage = stages?.[0];
    if (!stage) {
      return NextResponse.json({ error: "Pipeline stage required" }, { status: 409 });
    }

    let contactId: string | null = null;
    for (const [field, value] of [
      ["phone", validation.value.phone],
      ["email", validation.value.email],
    ] as const) {
      if (!value || contactId) continue;
      const { data: contacts, error: contactError } = await supabase
        .from("crm_contacts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq(field, value)
        .limit(1);
      if (contactError) {
        return NextResponse.json({ error: "Could not resolve CRM contact" }, { status: 500 });
      }
      contactId = contacts?.[0]?.id ?? null;
    }

    if (!contactId) {
      const { data: contact, error: createContactError } = await supabase
        .from("crm_contacts")
        .insert({
          organization_id: organizationId,
          name: validation.value.name,
          phone: validation.value.phone,
          email: validation.value.email,
        })
        .select("id")
        .maybeSingle();
      if (createContactError || !contact) {
        return NextResponse.json({ error: "Could not create CRM contact" }, { status: 500 });
      }
      contactId = contact.id;
    }

    const { data: lead, error: createLeadError } = await supabase
      .from("crm_leads")
      .insert({
        organization_id: organizationId,
        contact_id: contactId,
        stage_id: stage.id,
        source: validation.value.source,
      })
      .select("id, contact_id, stage_id")
      .maybeSingle();
    if (createLeadError || !lead) {
      return NextResponse.json({ error: "Could not create CRM lead" }, { status: 500 });
    }

    return NextResponse.json({ lead }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create CRM lead" }, { status: 500 });
  }
}
