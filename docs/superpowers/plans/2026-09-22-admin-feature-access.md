# Admin Feature Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Organize admin by product and grant Dashboard Ads, CRM, and Site Builder features per client organization.

**Architecture:** Server-owned registry fixes safe feature keys, icon names, and internal routes. Supabase stores catalog presentation/status and organization assignments. A single feature-access helper authorizes pages and APIs; the resolved list also renders customer menu.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase Postgres/RLS, Vitest, lucide-react.

---

## File structure

- Create lib/feature-catalog.ts: immutable allowlist, types, input validation, menu projection.
- Create lib/feature-access.ts: organization reads and authorization.
- Create lib/client-navigation.ts: pure customer menu state.
- Create supabase-feature-access.sql: idempotent tables, seeds, indexes, RLS.
- Create app/api/admin/features/route.ts, app/api/admin/organizations/route.ts, app/api/admin/organizations/[organizationId]/features/route.ts: protected management APIs.
- Create app/api/features/context/route.ts: customer menu API.
- Create focused admin pages and app/sites/page.tsx.
- Modify product pages/routes to enforce features.

### Task 1: Define safe feature catalog and client navigation

**Files:**
- Create: lib/feature-catalog.ts
- Create: lib/client-navigation.ts
- Test: tests/feature-catalog.test.ts
- Test: tests/client-navigation.test.ts

- [ ] **Step 1: Write failing tests**

~~~ts
import { describe, expect, it } from "vitest";
import { getFeatureDefinition, parseCatalogFeatureInput } from "../lib/feature-catalog";
import { getClientNavigation } from "../lib/client-navigation";

describe("feature catalog", () => {
  it("accepts only registered internal features", () => {
    expect(parseCatalogFeatureInput({ key: "crm", name: "CRM", description: "Funil", position: 2 })).toMatchObject({ ok: true });
    expect(parseCatalogFeatureInput({ key: "unsafe", name: "X", description: "X", position: 1 })).toEqual({ ok: false, error: "Feature não suportada" });
  });
  it("maps feature key to fixed route", () => {
    expect(getFeatureDefinition("dashboard_ads")?.route).toBe("/dashboard");
  });
});
describe("client navigation", () => {
  it("shows only active grants in registry order", () => {
    expect(getClientNavigation(["crm", "dashboard_ads"])).toEqual([
      expect.objectContaining({ key: "dashboard_ads", href: "/dashboard" }),
      expect.objectContaining({ key: "crm", href: "/crm" }),
    ]);
  });
});
~~~

- [ ] **Step 2: Run test to verify failure**

Run: npm test -- tests/feature-catalog.test.ts tests/client-navigation.test.ts

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement minimal registry and navigation**

~~~ts
export const FEATURE_KEYS = ["dashboard_ads", "crm", "site_builder"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

const definitions = {
  dashboard_ads: { key: "dashboard_ads", route: "/dashboard", icon: "BarChart3", defaultName: "Dashboard Ads" },
  crm: { key: "crm", route: "/crm", icon: "UsersRound", defaultName: "CRM" },
  site_builder: { key: "site_builder", route: "/sites", icon: "PanelsTopLeft", defaultName: "Criador de Sites" },
} as const;

export function getFeatureDefinition(key: string) {
  return Object.prototype.hasOwnProperty.call(definitions, key)
    ? definitions[key as FeatureKey]
    : null;
}
~~~

Implement parseCatalogFeatureInput with trimmed non-empty name and description, integer position greater than or equal to zero, and allowlisted key. Never accept caller route or icon. Implement getClientNavigation only from definitions, sorted by registry order.

- [ ] **Step 4: Run test to verify pass**

Run: npm test -- tests/feature-catalog.test.ts tests/client-navigation.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add lib/feature-catalog.ts lib/client-navigation.ts tests/feature-catalog.test.ts tests/client-navigation.test.ts
git commit -m "feat: add safe feature catalog"
~~~

### Task 2: Add organization feature schema, seeds, and RLS

**Files:**
- Create: supabase-feature-access.sql
- Modify: tests/crm-schema-contract.test.ts

- [ ] **Step 1: Write failing schema contract assertions**

~~~ts
expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.product_features");
expect(schema).toContain("CREATE TABLE IF NOT EXISTS public.organization_feature_accesses");
expect(schema).toContain("UNIQUE (organization_id, feature_id)");
expect(schema).toContain("product_features_admin_write");
expect(schema).toContain("organization_feature_accesses_member_read");
expect(schema).toContain("dashboard_ads");
expect(schema).toContain("site_builder");
~~~

- [ ] **Step 2: Run test to verify failure**

Run: npm test -- tests/crm-schema-contract.test.ts

Expected: FAIL because supabase-feature-access.sql does not exist.

- [ ] **Step 3: Write idempotent migration**

Create product_features with UUID primary key, unique key, name, description, status check for active/archived, non-negative position, timestamps, and update trigger. Create organization_feature_accesses with organization/feature foreign keys and unique organization/feature pair.

Seed dashboard_ads, crm, and site_builder using INSERT ON CONFLICT. Update presentation but preserve archived status. Add indexes for catalog status/order and organization ID.

Enable RLS. Member SELECT uses public.can_access_organization(organization_id). Admin catalog and assignment writes check auth.jwt app_metadata role equals admin. Do not grant ordinary users writes.

- [ ] **Step 4: Run contract test**

Run: npm test -- tests/crm-schema-contract.test.ts && git diff --check

Expected: PASS and no whitespace errors.

- [ ] **Step 5: Apply SQL after explicit action-time confirmation**

Use Supabase SQL Editor only after confirming target project and user approval. Verify:

~~~sql
select key, status, position from public.product_features order by position;
select tablename, policyname from pg_policies
where schemaname = 'public'
  and tablename in ('product_features', 'organization_feature_accesses');
~~~

- [ ] **Step 6: Commit**

~~~bash
git add supabase-feature-access.sql tests/crm-schema-contract.test.ts
git commit -m "feat: add organization feature access schema"
~~~

### Task 3: Implement server authorization boundary

**Files:**
- Create: lib/feature-access.ts
- Test: tests/feature-access.test.ts

- [ ] **Step 1: Write failing authorization tests**

~~~ts
it("returns unauthenticated before querying feature access", async () => {
  requireActiveOrganization.mockResolvedValue({ supabase: {}, user: null, organizationId: null });
  await expect(requireOrganizationFeature("crm")).resolves.toMatchObject({ ok: false, status: 401 });
});
it("rejects organization without requested active feature", async () => {
  requireActiveOrganization.mockResolvedValue(activeAccess(query({ data: null, error: null })));
  await expect(requireOrganizationFeature("crm")).resolves.toMatchObject({ ok: false, status: 403 });
});
it("permits organization granted active feature", async () => {
  requireActiveOrganization.mockResolvedValue(activeAccess(query({ data: { feature: { key: "crm", status: "active" } }, error: null })));
  await expect(requireOrganizationFeature("crm")).resolves.toMatchObject({ ok: true, organizationId });
});
~~~

- [ ] **Step 2: Run test to verify failure**

Run: npm test -- tests/feature-access.test.ts

Expected: FAIL because requireOrganizationFeature does not exist.

- [ ] **Step 3: Implement helper**

~~~ts
export type FeatureAccessResult =
  | { ok: true; supabase: SupabaseClient; user: User; organizationId: string }
  | { ok: false; status: 401 | 403 | 409; error: string };

export async function requireOrganizationFeature(key: FeatureKey, requestedOrganizationId?: string | null): Promise<FeatureAccessResult> {
  const access = await requireActiveOrganization(requestedOrganizationId);
  if (!access.user) return { ok: false, status: 401, error: "Unauthorized" };
  if (!access.organizationId) return { ok: false, status: 409, error: "Organization membership required" };
  const { data, error } = await access.supabase
    .from("organization_feature_accesses")
    .select("feature:product_features!inner(key, status)")
    .eq("organization_id", access.organizationId)
    .eq("feature.key", key)
    .eq("feature.status", "active")
    .maybeSingle();
  if (error) throw new Error("Could not load feature access: " + error.message);
  return data ? { ok: true, ...access, organizationId: access.organizationId } : { ok: false, status: 403, error: "Feature access required" };
}
~~~

Add listOrganizationFeatureKeys; return only active valid registry keys.

- [ ] **Step 4: Run test to verify pass**

Run: npm test -- tests/feature-access.test.ts tests/organization-access.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add lib/feature-access.ts tests/feature-access.test.ts
git commit -m "feat: add organization feature authorization"
~~~

### Task 4: Create protected feature-management APIs

**Files:**
- Create: app/api/admin/features/route.ts
- Create: app/api/admin/organizations/route.ts
- Create: app/api/admin/organizations/[organizationId]/features/route.ts
- Create: app/api/features/context/route.ts
- Test: tests/admin-feature-routes.test.ts

- [ ] **Step 1: Write failing route tests**

Cover 401 and 403 from requireAdmin, catalog key rejection, company feature replacement, no cross-company leakage, and customer context returning only active assigned keys. Use existing Vitest hoisted mocks and thenable query builders from tests/crm-routes.test.ts.

- [ ] **Step 2: Run test to verify failure**

Run: npm test -- tests/admin-feature-routes.test.ts

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement routes**

GET admin/features returns catalog. POST and PATCH accept only parsed allowlisted fields; archive through PATCH status archived, with no DELETE route.

GET admin/organizations returns id, name, slug, and member count. GET admin/organizations/:id/features returns catalog plus enabled. PUT accepts featureKeys, validates duplicates/keys, deletes only target company assignments, and inserts replacement rows through createAdminClient after requireAdmin.

GET features/context uses requireActiveOrganization and returns organizationId plus getClientNavigation(keys). It never exposes service-role data.

- [ ] **Step 4: Run test to verify pass**

Run: npm test -- tests/admin-feature-routes.test.ts tests/feature-access.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add app/api/admin/features/route.ts app/api/admin/organizations/route.ts app/api/admin/organizations/[organizationId]/features/route.ts app/api/features/context/route.ts tests/admin-feature-routes.test.ts
git commit -m "feat: add admin feature management APIs"
~~~

### Task 5: Build organized admin and client navigation

**Files:**
- Create: lib/admin-feature-ui-state.ts
- Create: app/admin/AdminShell.tsx
- Create: app/admin/features/page.tsx
- Create: app/admin/clients/page.tsx
- Create: app/admin/products/page.tsx
- Create: components/ClientFeatureNavigation.tsx
- Modify: app/admin/page.tsx
- Modify: app/dashboard/DashboardClient.tsx
- Modify: app/crm/CrmClient.tsx
- Test: tests/admin-feature-ui-state.test.ts

- [ ] **Step 1: Write failing UI-state test**

~~~ts
it("adds and removes selected company features without duplicates", () => {
  expect(applyFeatureSelection(["crm"], "dashboard_ads", true)).toEqual(["crm", "dashboard_ads"]);
  expect(applyFeatureSelection(["crm"], "crm", true)).toEqual(["crm"]);
  expect(applyFeatureSelection(["crm", "dashboard_ads"], "crm", false)).toEqual(["dashboard_ads"]);
});
~~~

- [ ] **Step 2: Run test to verify failure**

Run: npm test -- tests/admin-feature-ui-state.test.ts

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement admin views**

Keep black #050505, green #39FF14, focus states, labels, keyboard navigation, loading/error/retry state, and confirmation before archival/deactivation. Admin shell links: Produtos e ajustes with Landing Page, Dashboard Ads, CRM, Criador de Sites, Gateways de pagamento, APIs; then Features, Clientes, and existing Usuários.

Move existing user management to /admin/users without dropping any operation. Product tabs show real configuration status only. Features page edits safe catalog presentation/order/status and explains that implementation must exist before activation. Clients page selects organization and saves complete feature keys.

Render ClientFeatureNavigation from features/context in client headers. Use fixed local Lucide icon map; never instantiate database-provided component name.

- [ ] **Step 4: Run focused tests and lint**

Run: npm test -- tests/admin-feature-ui-state.test.ts tests/client-navigation.test.ts && npm run lint

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add app/admin components/ClientFeatureNavigation.tsx lib/admin-feature-ui-state.ts app/dashboard/DashboardClient.tsx app/crm/CrmClient.tsx tests/admin-feature-ui-state.test.ts
git commit -m "feat: organize admin and client navigation"
~~~

### Task 6: Enforce feature access in pages and APIs

**Files:**
- Create: app/sites/page.tsx
- Modify: app/dashboard/page.tsx
- Modify: app/crm/page.tsx
- Modify: every app/api/meta route
- Modify: every app/api/crm route
- Create: tests/feature-gated-routes.test.ts
- Modify: tests/crm-routes.test.ts

- [ ] **Step 1: Write failing gates**

~~~ts
it("returns feature denial before CRM data query", async () => {
  requireOrganizationFeature.mockResolvedValue({ ok: false, status: 403, error: "Feature access required" });
  const response = await getLeads(new Request("http://localhost/api/crm/leads"));
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "Feature access required" });
});
it("returns feature denial from dashboard API", async () => {
  requireOrganizationFeature.mockResolvedValue({ ok: false, status: 403, error: "Feature access required" });
  const response = await getInsights(new Request("http://localhost/api/meta/insights"));
  expect(response.status).toBe(403);
});
~~~

- [ ] **Step 2: Run test to verify failure**

Run: npm test -- tests/feature-gated-routes.test.ts

Expected: FAIL because product routes still use raw authentication.

- [ ] **Step 3: Apply gates**

Every CRM route calls requireOrganizationFeature for crm with requested organization ID. Every Meta route calls requireOrganizationFeature for dashboard_ads. On failure return NextResponse JSON error/status. On success use access.supabase and access.user, avoiding duplicate auth.

Server pages redirect only 401 to /login; 403 and 409 render reusable denied state with safe available-panel link. Create /sites with site_builder gate; allowed state says Creator is being prepared. It does not implement site generation.

- [ ] **Step 4: Run affected tests**

Run: npm test -- tests/feature-gated-routes.test.ts tests/crm-routes.test.ts tests/crm-route-contracts.test.ts

Expected: PASS. Update CRM mocks to mock requireOrganizationFeature while retaining organization-ID assertions.

- [ ] **Step 5: Commit**

~~~bash
git add app/dashboard/page.tsx app/crm/page.tsx app/sites/page.tsx app/api/meta app/api/crm tests/feature-gated-routes.test.ts tests/crm-routes.test.ts
git commit -m "feat: enforce feature access on product modules"
~~~

### Task 7: Full verification and deployment handoff

**Files:**
- Modify only if verification finds scoped defect.

- [ ] **Step 1: Run automated checks**

~~~bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
git status --short --branch
~~~

Expected: test, typecheck, lint, and build exit 0; no whitespace errors; no uncommitted implementation changes.

- [ ] **Step 2: Verify flows**

As admin master, verify catalog, company selection, archive confirmation, product tabs, existing user management. As Company A member, enabled CRM opens; disabled Dashboard Ads is absent and dashboard plus insights API deny. As Company B member, verify Company A grants do not appear.

- [ ] **Step 3: Recheck policy behavior**

In SQL Editor, verify ordinary users cannot write feature tables, members can read only own company grants, and admin API can replace selected company grants.

- [ ] **Step 4: Commit verification fixes, if any**

~~~bash
git add <only-files-fixed-during-verification>
git commit -m "fix: verify feature access integration"
~~~

- [ ] **Step 5: Sync after explicit deployment approval**

Push to GitHub and use established Hostinger sync only after user approves deployment. Verify production admin, CRM, dashboard, and sites routes. Do not apply database migration without explicit action-time confirmation.

