import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.SUPABASE_RLS_TEST_URL ?? "";
const anonKey = process.env.SUPABASE_RLS_TEST_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_RLS_TEST_SERVICE_ROLE_KEY ?? "";
const configured = Boolean(url && anonKey && serviceRoleKey);
const suite = configured ? describe : describe.skip;
const password = "RlsTest-Only-ChangeMe-2026!";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type TestUser = { id: string; email: string };

function serviceClient(): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authenticatedClient(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

suite("CRM RLS integration (disposable Supabase project only)", () => {
  let admin: SupabaseClient;
  const users: TestUser[] = [];
  const organizationIds: string[] = [];
  let organizationAId = "";
  let organizationBId = "";
  let metaOrganizationAId = "";
  let metaOrganizationBId = "";
  let contactAId = "";
  let contactBId = "";
  let facebookTokenAId = "";
  let facebookTokenBId = "";
  let adAccountAId = "";
  let adAccountBId = "";
  let owner: TestUser;
  let sharedMember: TestUser;
  let platformAdmin: TestUser;

  beforeAll(async () => {
    admin = serviceClient();
    async function createUser(label: string, appMetadata?: Record<string, string>): Promise<TestUser> {
      const email = `crm-rls-${label}-${suffix}@example.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: appMetadata,
      });
      if (error || !data.user) throw error ?? new Error("Could not create RLS test user");
      const user = { id: data.user.id, email };
      users.push(user);
      return user;
    }

    owner = await createUser("owner");
    sharedMember = await createUser("shared");
    platformAdmin = await createUser("admin", { role: "admin" });

    const [{ data: ownerMemberships, error: ownerMembershipError }, { data: sharedMemberships, error: sharedMembershipError }] = await Promise.all([
      admin.from("organization_memberships").select("organization_id").eq("user_id", owner.id).eq("role", "owner"),
      admin.from("organization_memberships").select("organization_id").eq("user_id", sharedMember.id).eq("role", "owner"),
    ]);
    if (ownerMembershipError || sharedMembershipError || !ownerMemberships?.[0] || !sharedMemberships?.[0]) {
      throw ownerMembershipError ?? sharedMembershipError ?? new Error("Could not find personal RLS test organizations");
    }
    metaOrganizationAId = ownerMemberships[0].organization_id;
    metaOrganizationBId = sharedMemberships[0].organization_id;

    const { data: organizations, error: organizationError } = await admin
      .from("organizations")
      .insert([
        { name: `RLS Org A ${suffix}`, slug: `rls-a-${suffix}`.slice(0, 80) },
        { name: `RLS Org B ${suffix}`, slug: `rls-b-${suffix}`.slice(0, 80) },
      ])
      .select("id, slug");
    if (organizationError || !organizations || organizations.length !== 2) {
      throw organizationError ?? new Error("Could not create RLS test organizations");
    }
    organizationAId = organizations.find((organization) => organization.slug.startsWith("rls-a-"))!.id;
    organizationBId = organizations.find((organization) => organization.slug.startsWith("rls-b-"))!.id;
    organizationIds.push(organizationAId, organizationBId);

    const { error: membershipError } = await admin.from("organization_memberships").insert([
      { organization_id: organizationAId, user_id: owner.id, role: "owner" },
      { organization_id: organizationAId, user_id: sharedMember.id, role: "agent" },
      { organization_id: metaOrganizationAId, user_id: sharedMember.id, role: "agent" },
    ]);
    if (membershipError) throw membershipError;

    const { data: contacts, error: contactError } = await admin.from("crm_contacts").insert([
      { organization_id: organizationAId, name: "RLS Shared Contact", email: `shared-${suffix}@example.test` },
      { organization_id: organizationBId, name: "RLS Private Contact", email: `private-${suffix}@example.test` },
    ]).select("id, organization_id");
    if (contactError || !contacts || contacts.length !== 2) {
      throw contactError ?? new Error("Could not create RLS test contacts");
    }
    contactAId = contacts.find((contact) => contact.organization_id === organizationAId)!.id;
    contactBId = contacts.find((contact) => contact.organization_id === organizationBId)!.id;

    const [{ data: facebookTokens, error: facebookTokenError }, { data: adAccounts, error: adAccountError }] = await Promise.all([
      admin.from("facebook_tokens").insert([
        { user_id: owner.id, facebook_user_id: `fb-a-${suffix}`, access_token_encrypted: "test-token" },
        { user_id: sharedMember.id, facebook_user_id: `fb-b-${suffix}`, access_token_encrypted: "test-token" },
      ]).select("id, organization_id"),
      admin.from("ad_accounts").insert([
        { user_id: owner.id, meta_account_id: `act-a-${suffix}`, meta_account_name: "RLS Account A" },
        { user_id: sharedMember.id, meta_account_id: `act-b-${suffix}`, meta_account_name: "RLS Account B" },
      ]).select("id, organization_id"),
    ]);
    if (facebookTokenError || adAccountError || !facebookTokens || !adAccounts || facebookTokens.length !== 2 || adAccounts.length !== 2) {
      throw facebookTokenError ?? adAccountError ?? new Error("Could not create RLS test Meta data");
    }
    facebookTokenAId = facebookTokens.find((token) => token.organization_id === metaOrganizationAId)!.id;
    facebookTokenBId = facebookTokens.find((token) => token.organization_id === metaOrganizationBId)!.id;
    adAccountAId = adAccounts.find((account) => account.organization_id === metaOrganizationAId)!.id;
    adAccountBId = adAccounts.find((account) => account.organization_id === metaOrganizationBId)!.id;
  }, 30_000);

  afterAll(async () => {
    const userIds = users.map((user) => user.id);
    const { data: memberships } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .in("user_id", userIds);
    const personalOrganizationIds = (memberships ?? []).map((membership) => membership.organization_id);
    await admin.from("facebook_tokens").delete().in("id", [facebookTokenAId, facebookTokenBId].filter(Boolean));
    await admin.from("ad_accounts").delete().in("id", [adAccountAId, adAccountBId].filter(Boolean));
    await admin.from("organizations").delete().in("id", [...new Set([...organizationIds, ...personalOrganizationIds])]);
    await Promise.all(users.map((user) => admin.auth.admin.deleteUser(user.id)));
  }, 30_000);

  it("denies cross-organization reads", async () => {
    const client = await authenticatedClient(owner.email);
    const { data, error } = await client.from("crm_contacts").select("id").eq("id", contactBId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("allows shared organization membership", async () => {
    const client = await authenticatedClient(sharedMember.email);
    const { data, error } = await client.from("crm_contacts").select("id").eq("id", contactAId);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: contactAId }]);
  });

  it("scopes Facebook tokens to shared organization members", async () => {
    const ownerClient = await authenticatedClient(owner.email);
    const sharedClient = await authenticatedClient(sharedMember.email);
    const [{ data: denied, error: deniedError }, { data: allowed, error: allowedError }] = await Promise.all([
      ownerClient.from("facebook_tokens").select("id").eq("id", facebookTokenBId),
      sharedClient.from("facebook_tokens").select("id").eq("id", facebookTokenAId),
    ]);

    expect(deniedError).toBeNull();
    expect(denied).toEqual([]);
    expect(allowedError).toBeNull();
    expect(allowed).toEqual([{ id: facebookTokenAId }]);
  });

  it("scopes ad accounts to shared organization members", async () => {
    const ownerClient = await authenticatedClient(owner.email);
    const sharedClient = await authenticatedClient(sharedMember.email);
    const [{ data: denied, error: deniedError }, { data: allowed, error: allowedError }] = await Promise.all([
      ownerClient.from("ad_accounts").select("id").eq("id", adAccountBId),
      sharedClient.from("ad_accounts").select("id").eq("id", adAccountAId),
    ]);

    expect(deniedError).toBeNull();
    expect(denied).toEqual([]);
    expect(allowedError).toBeNull();
    expect(allowed).toEqual([{ id: adAccountAId }]);
  });

  it("allows app_metadata platform admin bypass", async () => {
    const client = await authenticatedClient(platformAdmin.email);
    const { data, error } = await client.from("crm_contacts").select("id").in("id", [contactAId, contactBId]);

    expect(error).toBeNull();
    expect(new Set((data ?? []).map((contact) => contact.id))).toEqual(new Set([contactAId, contactBId]));
  });
});
