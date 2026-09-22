# DashAds Pro Sales, Packages, and Billing Design

## Goal

Add a public, high-conversion sales page for DashAds Pro and a platform-admin area that manages published packages. The default offer is DashAds Pro for R$ 97 per month. Approved Mercado Pago or Efí payments must create a customer account, activate access, and send an access email automatically.

## Product Decisions

- Public design uses deep black backgrounds and fluorescent green highlights (`#050505`, `#39FF14`).
- The sales message focuses on existing DashAds Pro value: Meta Ads dashboard, CRM pipeline, WhatsApp operation, campaign reports, landing pages, and generated pages.
- The primary CTA starts checkout. A secondary CTA opens the configured WhatsApp conversation.
- The first published offer is `DashAds Pro`, priced at R$ 97.00 monthly.
- Platform administrators can add, edit, reorder, publish, hide, and highlight packages.
- Package changes appear on an already open public pricing page through Supabase Realtime. New page loads also read the current published offers from the database.
- Mercado Pago and Efí are native provider integrations. A package can alternatively use a configured external checkout link.
- Only an external provider with a verified webhook can grant access automatically. The UI must not imply automatic access for an external link that lacks a webhook mapping.
- Payment approval creates a Supabase user when needed, activates the subscription, creates the customer organization and owner membership, and sends an email invitation to define access.

## Public Experience

`/` becomes the sales page for unauthenticated visitors. The page has these sections, in this order:

1. Compact navigation with login and anchored feature/pricing links.
2. Hero explaining that DashAds Pro unifies campaigns, leads, WhatsApp, and pages. It shows a product metrics preview and both purchase and WhatsApp actions.
3. Benefits grid using product capabilities, not invented integrations or performance claims.
4. Product workflow section: campaign data enters DashAds, leads are organized in CRM, conversion pages are published, and WhatsApp supports the sale.
5. Dynamic pricing section. The highlighted published package is visually primary. Each package shows its benefits, monthly price, checkout CTA, and the optional WhatsApp CTA.
6. FAQ covering account creation after payment, supported payment methods, cancellation, and where campaign data comes from.
7. Final checkout CTA and simple footer.

The page is responsive from 375px upward, keyboard accessible, and respects reduced-motion settings. Fluorescent green is reserved for actions, status, and emphasis so contrast and hierarchy remain clear.

## Admin Experience

The existing `/admin` area receives a `Pacotes e Vendas` section, available only to platform admins. It contains:

- Package list with draft/published state, highlight state, sort order, price, billing interval, and selected checkout type.
- Package editor for name, stable slug, short description, long benefit list, price in centavos, currency, monthly interval, featured flag, publish flag, order, WhatsApp number/message, and checkout configuration.
- Default package seed: `DashAds Pro`, R$ 97.00/month, published and featured.
- Checkout configuration options: `mercado_pago`, `efi`, or `external`.
- External offers require a URL. They are marked `manual` until a provider webhook configuration exists; only `automatic` offers can promise automatic access.
- Subscription list with customer email, package, provider, state, paid-through date, and latest provider event.

Admin editing does not expose payment credentials. Provider secrets remain server-only environment variables.

## Data Model

The additive SQL migration introduces platform-owned billing data. Platform admins have full access; customers only read their own subscription state.

### `billing_packages`

Public offer definition: ID, slug, name, description, benefits JSON array, price cents, currency, interval, checkout provider, external URL when applicable, external webhook mode, WhatsApp configuration, featured/published flags, position, created and updated timestamps.

### `billing_checkout_attempts`

Links an initiated checkout to package, normalized customer email, optional existing user ID, provider, provider checkout/payment reference, status, expiration, and timestamps. Provider references are unique per provider.

### `billing_subscriptions`

Stores the entitlement: package, user, organization, provider, provider subscription/payment reference, status (`pending`, `active`, `past_due`, `cancelled`, `expired`), period start/end, cancellation timestamp, and timestamps. A user may have one active platform subscription at a time.

### `billing_payment_events`

Immutable webhook audit record: provider, provider event ID, normalized event type, validated payload digest, received time, processing state, failure detail, and related checkout/subscription. `(provider, provider_event_id)` is unique for idempotency.

## Payment Flow

1. Buyer selects a published package and supplies an email in a small checkout step.
2. Server validates package and email, creates `billing_checkout_attempts`, and delegates checkout creation to the chosen provider adapter.
3. Browser redirects to Mercado Pago, Efí, or configured external checkout URL. It never receives a provider secret.
4. Provider sends a webhook to a dedicated server route.
5. Server verifies signature and timestamp, fetches current payment state from the provider API, then writes one idempotent payment event.
6. An approved recurring or initial payment activates the matching subscription inside a transaction.
7. When buyer has no user account, the server invites the email through Supabase Auth. The invitation redirects to the existing password setup route. When buyer already has an account, the subscription attaches to that user.
8. The activation transaction bootstraps/uses the buyer organization and creates owner membership. It records the package entitlement before email delivery.
9. Authenticated product routes check active entitlement. Platform admins keep access for support and administration.
10. Renewal, cancellation, refund, or payment failure webhooks update subscription state. Access ends after the paid-through date, not merely because a webhook was received.

## Provider Boundary

Use a small server-only provider interface:

- `createCheckout(input)` returns redirect URL and provider reference.
- `verifyWebhook(request)` verifies provider signature and parses event identity.
- `fetchPayment(reference)` returns normalized provider state and payment period.

Mercado Pago and Efí each implement this interface. External checkout has no native implementation until its provider webhook is explicitly supported. This prevents treating a browser redirect as payment proof.

## Security and Reliability

- Validate webhook signature before any subscription mutation.
- Fetch provider payment details server-side; do not trust client success URLs or raw webhook status alone.
- Use idempotency uniqueness and transactional subscription activation to handle retries safely.
- Store provider secrets only in server environment variables. Do not place secrets in package rows or admin forms.
- Validate all URLs against `https:` and configured safe domains before redirecting.
- Use app metadata `role = admin` for platform admin checks, matching the current hardened authorization model.
- Log safe provider reference/status metadata. Never log tokens, webhook secrets, card data, or raw sensitive payload fields.

## Error Handling

- Checkout creation failure keeps the package page usable and shows a retry message with WhatsApp support action.
- Invalid, unsigned, duplicate, or unknown webhook events return a safe status and leave entitlement unchanged.
- User invitation failure leaves the approved subscription pending delivery and records retry-safe failure state; it does not create duplicate accounts or subscriptions.
- Published package updates validate required fields and reject a native automatic checkout when its provider credentials are absent.

## Testing

- Package validation, ordering, featured selection, and public visibility.
- Public pricing state and Realtime update reducer behavior.
- Admin authorization and CRUD route contracts.
- Checkout attempt creation and provider selection.
- Webhook signature rejection, duplicate event idempotency, and approved activation.
- Existing-user and new-user account activation paths.
- Cancellation/failure period handling and entitlement checks.
- Responsive page interactions and accessibility semantics for primary actions.

## Out of Scope

- Storing payment cards, PIX credentials, or provider secrets in DashAds Pro.
- Promising automatic access for arbitrary external URLs without a verified webhook adapter.
- Tax invoice generation, chargeback workflows, affiliate commissions, coupons, and multi-currency billing.
- Changes to existing Meta Ads, CRM, WhatsApp, or landing-page business data beyond entitlement gating.
