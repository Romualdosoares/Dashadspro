# DashAds CRM, WhatsApp and Landing Pages Design

## Goal

Extend DashAds from a Meta Ads dashboard into a multi-tenant product that connects campaign performance, landing-page leads, WhatsApp conversations and recorded sales. The product will support the operator's own business first and later sell isolated client accounts.

## Product decisions

- Meta Ads remains the product core. The CRM adds commercial outcome and return-on-ad-spend context to campaign data.
- Lead sources in scope are DashAds landing pages and WhatsApp. Instagram is out of scope.
- Every client has a separate organization, users, Meta accounts, Z-API instance, leads, conversations, pipeline and sales.
- Each client supplies and controls its own Z-API instance and phone number.
- Landing pages support DashAds subdomains, verified custom domains and static `.zip` exports.
- Page generation uses Kie.ai server-side. GPT-5.6 Terra is the default generation model. The model provider is configurable so a documented GPT-6 model can be enabled later without changing page data or editor behavior.
- Page generation produces a validated page schema, never executable model-generated code.

## Delivery phases

### Phase 1: Multi-tenant CRM core

Create organizations, memberships and organization-scoped data. Create contacts, leads, pipeline stages and deals. Add `/crm` as a focused module instead of adding another large section to `DashAdsPro.tsx`.

Global platform administration remains the existing `app_metadata.role = admin` role. Organization membership roles are `owner`, `manager` and `agent`. The dashboard role reader must use `app_metadata`, matching the existing admin guard.

Existing users receive one personal organization during migration. Existing user-owned rows are associated with that organization before organization-level row-level security is enabled.

### Phase 2: Landing page studio and lead capture

Create a landing-page studio with:

- structured page blocks: hero, benefit list, proof, offer, FAQ, image, video, button and form;
- generation brief: product, audience, offer, tone, colors and WhatsApp call-to-action;
- Kie.ai generation, preview, regenerate and manual edit;
- immutable versions and explicit publish and rollback actions;
- static page rendering from the same schema used in the editor;
- UTM, `fbclid`, referrer and landing-page attribution capture;
- form submission that creates or updates a CRM contact and lead.

Published pages initially use `<slug>.pages.dashadspro.cloud`. Custom domains use DNS CNAME instructions and automated ownership verification. DashAds issues HTTPS after verification. The product never requests the customer's hosting credentials.

Static export creates a `.zip` containing page assets and deployment instructions. Exported forms use a page-specific public DashAds capture URL so submitted leads still reach the customer's CRM. The package contains no secret, API key or Z-API token.

### Phase 3: Z-API conversations and safe automation

Store each organization's Z-API configuration encrypted. Map signed, idempotent Z-API webhooks to one organization and create or update contacts, conversations and messages.

Automations are opt-in only. They include approval state, quiet hours, rate limits, a stop keyword and an audit log. Initial automation scope is a welcome or qualification reply triggered by an inbound conversation or an explicit landing-page consent. Bulk unsolicited messaging is excluded.

### Phase 4: Revenue attribution and business dashboard

Let users mark deals won or lost and record revenue. Link a deal to its captured landing-page and Meta campaign, ad set and ad identifiers when available. Show leads, conversations, conversion rate, revenue and ROAS beside Meta campaign metrics. Links are shown as attribution, not as a claim that Meta reported the sale.

## Architecture

The application stores a versioned page schema as JSON. A shared renderer consumes that schema for editor preview, DashAds-hosted pages, custom-domain pages and static export. This avoids maintaining four incompatible page implementations.

The generation endpoint accepts a brief, calls Kie.ai only from the server, validates the returned schema against a strict allowlist and saves a draft version. The editor only exposes supported properties and block types. Generated images are stored as owned page assets, not hotlinked from temporary model URLs.

Public form submission resolves the page identity, validates the per-page submission key, rate-limits requests, checks a honeypot field, normalizes contact details and records attribution. It then writes a contact, lead and audit event in the page organization.

## Data model

- `organizations`: client account and tenant boundary.
- `organization_memberships`: organization role for each authenticated user.
- `crm_contacts`: normalized contact identity and consent state.
- `crm_leads`: source, attribution, owner and pipeline stage.
- `crm_pipeline_stages`: ordered organization-scoped stages.
- `crm_deals`: outcome, value, currency and Meta attribution references.
- `whatsapp_instances`: encrypted Z-API settings and webhook identity.
- `whatsapp_conversations` and `whatsapp_messages`: inbound and outbound conversation history.
- `automation_rules` and `automation_events`: guarded message rules and audit history.
- `landing_pages`: page metadata, organization, status and publication settings.
- `landing_page_versions`: immutable structured page schema and generation metadata.
- `landing_page_domains`: DashAds subdomain or verified custom-domain mapping.
- `landing_page_submissions`: submission idempotency and attribution audit record.

All tenant tables have `organization_id`, indexes that begin with it where queried by tenant, and row-level security based on `organization_memberships`. Global admin access is explicit and separately tested.

## Failure handling

- Kie.ai timeout, invalid output, quota and rate-limit failures leave the current draft unchanged and show a retryable error.
- A generated schema that fails validation is rejected and never published.
- Domain records remain pending until DNS validation succeeds; pages stay available on the DashAds subdomain.
- Duplicate webhooks and duplicate form retries are idempotent.
- Invalid public submissions return a generic response and do not disclose organization or page configuration.
- Missing, revoked or invalid Z-API credentials disable sending for that organization without affecting other organizations.

## Testing and verification

- Unit tests for role resolution, membership authorization, schema validation, attribution parsing, page export and automation safeguards.
- Integration tests for row-level security, form capture, webhook idempotency and cross-organization denial.
- End-to-end tests for generation to draft, manual editing, publishing, public form capture, CRM lead creation and static export.
- Domain verification and Z-API integration use documented sandbox or test credentials before production activation.
- Each phase runs typecheck, lint, tests and production build before merge and deployment.

## Explicit exclusions

- Instagram messaging and Instagram lead capture.
- Client hosting-panel credentials and automatic deployment to a third-party host.
- Model-generated arbitrary JavaScript or server code.
- Bulk or unsolicited WhatsApp campaigns.
- A GPT-6 Kie.ai model before Kie.ai documents and enables it for the configured account.
