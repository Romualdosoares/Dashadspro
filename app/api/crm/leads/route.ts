import { NextResponse } from "next/server";
import { requireActiveOrganization } from "../../../../lib/organization-access";
import { validateLeadCreate } from "../../../../lib/crm-validation";

type CrmContact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type ContactResolution =
  | { ok: true; contact: CrmContact | null }
  | { ok: false; error: "database" | "conflict" };

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

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

async function findContact(
  supabase: Awaited<ReturnType<typeof requireActiveOrganization>>["supabase"],
  organizationId: string,
  field: "phone" | "email",
  value: string | null,
): Promise<ContactResolution> {
  if (!value) return { ok: true, contact: null };

  const { data, error } = await supabase
    .from("crm_contacts")
    .select("id, name, phone, email")
    .eq("organization_id", organizationId)
    .eq(field, value)
    .limit(1);
  if (error) return { ok: false, error: "database" };

  return { ok: true, contact: data?.[0] ?? null };
}

async function resolveContact(
  supabase: Awaited<ReturnType<typeof requireActiveOrganization>>["supabase"],
  organizationId: string,
  input: { name: string; phone: string | null; email: string | null },
): Promise<ContactResolution> {
  const [phoneResult, emailResult] = await Promise.all([
    findContact(supabase, organizationId, "phone", input.phone),
    findContact(supabase, organizationId, "email", input.email),
  ]);
  if (!phoneResult.ok || !emailResult.ok) {
    return { ok: false, error: "database" };
  }

  const contacts = [phoneResult.contact, emailResult.contact].filter(
    (contact): contact is CrmContact => contact !== null,
  );
  if (contacts.length === 2 && contacts[0].id !== contacts[1].id) {
    return { ok: false, error: "conflict" };
  }

  return { ok: true, contact: contacts[0] ?? null };
}

async function enrichContact(
  supabase: Awaited<ReturnType<typeof requireActiveOrganization>>["supabase"],
  organizationId: string,
  contact: CrmContact,
  input: { name: string; phone: string | null; email: string | null },
): Promise<"ok" | "database" | "conflict"> {
  const updates: Partial<Pick<CrmContact, "name" | "phone" | "email">> = {};
  if (!contact.name.trim()) updates.name = input.name;
  if (!contact.phone && input.phone) updates.phone = input.phone;
  if (!contact.email && input.email) updates.email = input.email;
  if (Object.keys(updates).length === 0) return "ok";

  const { error } = await supabase
    .from("crm_contacts")
    .update(updates)
    .eq("id", contact.id)
    .eq("organization_id", organizationId);
  if (isUniqueViolation(error)) return "conflict";
  return error ? "database" : "ok";
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
      .select("id, contact_id, stage_id, source, status, created_at, contact:crm_contacts!crm_leads_organization_id_contact_id_fkey(id, name, phone, email), stage:crm_pipeline_stages!crm_leads_organization_id_stage_id_fkey(id, name, position)")
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

    let resolution = await resolveContact(supabase, organizationId, validation.value);
    if (!resolution.ok) {
      if (resolution.error === "database") {
        return NextResponse.json({ error: "Could not resolve CRM contact" }, { status: 500 });
      }
      return NextResponse.json({ error: "Contact identities conflict" }, { status: 409 });
    }

    let contact = resolution.contact;
    if (!contact) {
      const { data: contact, error: createContactError } = await supabase
        .from("crm_contacts")
        .insert({
          organization_id: organizationId,
          name: validation.value.name,
          phone: validation.value.phone,
          email: validation.value.email,
        })
        .select("id, name, phone, email")
        .maybeSingle();
      if (!createContactError && contact) {
        resolution = { ok: true, contact };
      } else if (isUniqueViolation(createContactError)) {
        resolution = await resolveContact(supabase, organizationId, validation.value);
        if (!resolution.ok && resolution.error === "database") {
          return NextResponse.json({ error: "Could not resolve CRM contact" }, { status: 500 });
        }
        if (!resolution.ok || !resolution.contact) {
          return NextResponse.json({ error: "Contact identities conflict" }, { status: 409 });
        }
      } else {
        return NextResponse.json({ error: "Could not create CRM contact" }, { status: 500 });
      }
    }

    if (!resolution.ok || !resolution.contact) {
      return NextResponse.json({ error: "Could not resolve CRM contact" }, { status: 500 });
    }
    contact = resolution.contact;
    const enrichment = await enrichContact(supabase, organizationId, contact, validation.value);
    if (enrichment === "database") {
      return NextResponse.json({ error: "Could not enrich CRM contact" }, { status: 500 });
    }
    if (enrichment === "conflict") {
      return NextResponse.json({ error: "Contact identities conflict" }, { status: 409 });
    }

    const { data: lead, error: createLeadError } = await supabase
      .from("crm_leads")
      .insert({
        organization_id: organizationId,
        contact_id: contact.id,
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
