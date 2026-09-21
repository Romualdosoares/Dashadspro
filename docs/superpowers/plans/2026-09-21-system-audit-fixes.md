# System Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a secure, testable production baseline for DashAds Pro, create the missing Supabase schema, and correct confirmed Meta/WhatsApp data bugs.

**Architecture:** Add small pure validation and scheduling modules covered by Vitest, keep route handlers responsible for authentication and I/O, and make secret storage fail closed. Reduce the service worker to static public assets, migrate Next.js middleware to Proxy, and use idempotent SQL migrations for the new Supabase project.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres, Meta Graph API, Vitest, ESLint 9.

---

### Task 1: Repair tooling and vulnerable dependencies

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Rename: `middleware.ts` to `proxy.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Preserve the failing baseline**

Run `npm run lint` and record the expected failure `Invalid project directory .../lint`.

- [ ] **Step 2: Install the supported toolchain**

Run `npm uninstall next-pwa`, `npm install next@16.3.5`, and `npm install -D eslint-config-next@16.3.5 vitest@latest`.

- [ ] **Step 3: Configure ESLint 9 and test scripts**

Set scripts to:

```json
{
  "lint": "eslint .",
  "test": "vitest run",
  "typecheck": "tsc --noEmit"
}
```

Create a flat ESLint config from `eslint-config-next/core-web-vitals` and ignore only generated/vendor assets: `.next`, `node_modules`, and `public/sw.js`. Lint `DashAdsPro.tsx` because it is imported by the production dashboard.

- [ ] **Step 4: Migrate Middleware to Proxy**

Rename the file and exported function from `middleware` to `proxy`, preserving the matcher and authentication behavior.

- [ ] **Step 5: Add baseline security headers**

Configure `headers()` for `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`.

- [ ] **Step 6: Verify**

Run `npm run typecheck`, `npm run lint`, and a production build with non-secret placeholder Supabase variables. Expected: zero command failures and no middleware deprecation warning.

### Task 2: Prevent authenticated data from entering shared PWA caches

**Files:**
- Create: `tests/service-worker-cache.test.ts`
- Modify: `public/sw.js`
- Modify: `public/manifest.json`
- Delete: `public/sw-custom.js`

- [ ] **Step 1: Write failing service-worker tests**

Use a VM-backed service-worker harness and assert that `/api/meta/insights`, `/api/auth/me`, `/dashboard`, and external Meta creative images never call `respondWith`, while `/_next/static/chunk.js` does.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/service-worker-cache.test.ts`. Expected: authenticated/API/navigation cases fail because the current worker caches them.

- [ ] **Step 3: Apply the minimal cache fix**

Cache only manifest/icons, same-origin `/_next/static/` assets, and Google fonts. Remove API, navigation, and Meta creative response caching.

- [ ] **Step 4: Repair manifest references**

Remove the missing `/screenshots/dashboard.png` entry and the unused duplicate worker.

- [ ] **Step 5: Verify GREEN**

Run the focused test and the full test suite. Expected: all pass.

### Task 3: Add runtime validation for Meta routes and date comparisons

**Files:**
- Create: `lib/meta-validation.ts`
- Create: `tests/meta-validation.test.ts`
- Modify: `app/api/meta/manage/route.ts`
- Modify: `app/api/meta/consolidated/route.ts`
- Modify: `app/api/meta/insights/route.ts`
- Modify: `lib/meta-api.ts`

- [ ] **Step 1: Write failing tests**

Cover exact manage action allowlists, numeric IDs, a maximum of 25 account IDs, supported date presets, strict `YYYY-MM-DD` ranges, and previous ranges with equal inclusive duration.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/meta-validation.test.ts`. Expected: imports/functions do not exist.

- [ ] **Step 3: Implement pure validation helpers**

Export `validateManagePayload`, `parseAccountIds`, `parseDateSelection`, and `getPreviousPeriod`. Reject unknown actions and invalid or reversed dates with structured validation errors.

- [ ] **Step 4: Integrate helpers**

Return HTTP 400 for invalid input, limit fan-out, and compare every current range with the immediately preceding equal-length range.

- [ ] **Step 5: Make Graph version configurable**

Use `META_GRAPH_API_VERSION` with the supported stable default `v24.0` in one shared constant.

- [ ] **Step 6: Verify GREEN**

Run focused tests, typecheck, and lint.

### Task 4: Make token encryption fail closed

**Files:**
- Create: `lib/secret-storage.ts`
- Create: `tests/secret-storage.test.ts`
- Modify: `app/api/auth/callback/route.ts`
- Modify: `lib/meta-token.ts`
- Modify: `app/api/cron/whatsapp-report/route.ts`
- Modify: `supabase-setup.sql`

- [ ] **Step 1: Write failing tests**

Assert encryption/decryption throws when the key is absent, RPC returns an error, or decryption returns the original ciphertext. Assert successful RPC values are returned.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/secret-storage.test.ts`. Expected: helper is missing.

- [ ] **Step 3: Implement fail-closed helpers**

Use an injected RPC client, require `FACEBOOK_TOKEN_ENCRYPTION_KEY`, and never return or persist plaintext as fallback.

- [ ] **Step 4: Integrate and check persistence errors**

The OAuth callback must check encryption and `upsert` errors and redirect to a recoverable login error instead of silently continuing. Token readers and cron must reject undecryptable rows.

- [ ] **Step 5: Lock down SQL functions**

Set a safe function `search_path`, revoke execute from `PUBLIC`, `anon`, and `authenticated`, and grant only `service_role`.

- [ ] **Step 6: Verify GREEN**

Run focused tests, typecheck, and lint.

### Task 5: Correct WhatsApp configuration, scheduling, secrets, and timeouts

**Files:**
- Create: `lib/report-schedule.ts`
- Create: `tests/report-schedule.test.ts`
- Modify: `app/api/reports/config/route.ts`
- Modify: `app/api/reports/whatsapp/route.ts`
- Modify: `app/api/cron/whatsapp-report/route.ts`
- Modify: `lib/whatsapp-report.ts`
- Modify: `DashAdsPro.tsx`
- Modify: `supabase-whatsapp-reports.sql`

- [ ] **Step 1: Write failing schedule tests**

Cover local-hour storage without UTC conversion, Monday-only weekly runs, duplicate suppression within the same local slot, invalid timezones, and Brazilian phone normalization.

- [ ] **Step 2: Verify RED**

Run `npm test -- tests/report-schedule.test.ts`. Expected: helper is missing.

- [ ] **Step 3: Implement scheduling helpers**

Export `isReportDue` and `normalizeBrazilianPhone`; compare hours in the configured IANA timezone, require Monday for weekly schedules, and skip a slot already represented by `last_sent_at`.

- [ ] **Step 4: Fix the schema contract**

Use `schedule_hours int[] NOT NULL DEFAULT ARRAY[11]`, validate every hour as `0..23`, and keep the migration idempotent.

- [ ] **Step 5: Protect Z-API credentials**

Store the token encrypted with the shared secret helper, return only a fixed mask to the browser, preserve the existing secret when that mask is resubmitted, and decrypt only immediately before sending.

- [ ] **Step 6: Fix frontend hour handling**

Store and submit the selected Brasília/local hour directly. Remove the current `+3/-3` conversion.

- [ ] **Step 7: Add request timeouts and error propagation**

Use `AbortSignal.timeout(15000)` for Meta and Z-API requests. Do not build or send a zero-valued report when collection failed.

- [ ] **Step 8: Verify GREEN**

Run focused tests, full tests, typecheck, and lint.

### Task 6: Create and verify the new Supabase schema

**Files:**
- Modify: `supabase-setup.sql`
- Modify: `supabase-user-preferences.sql`
- Modify: `supabase-whatsapp-reports.sql`

- [ ] **Step 1: Review idempotency and security**

Ensure each table uses `CREATE TABLE IF NOT EXISTS`, each policy is dropped before recreation, trigger functions have fixed search paths, and secret functions are service-role only.

- [ ] **Step 2: Apply scripts through Supabase SQL Editor**

Run the three reviewed scripts against project `tjbzujmmdwovarmvswpt`, one script per query, and require visible success before continuing.

- [ ] **Step 3: Verify through REST schema cache**

Issue anonymous `limit=0` requests for `profiles`, `facebook_tokens`, `ad_accounts`, `user_preferences`, and `whatsapp_reports`. Expected: HTTP 200 with RLS-filtered empty results instead of PGRST205.

### Task 7: Final verification and deployment

**Files:**
- Modify: `.env.example`
- Modify: documentation only if required by the final configuration

- [ ] **Step 1: Document required environment names**

Include placeholders for Supabase, site URL, token encryption, Meta API version, and cron secret without committing any real secret.

- [ ] **Step 2: Run complete verification**

Run `npm test`, `npm run typecheck`, `npm run lint`, placeholder-env `npm run build`, and `npm audit --omit=dev`. Expected: all functional commands pass and no critical/high production vulnerabilities remain.

- [ ] **Step 3: Review diff and secrets**

Run `git diff --check`, inspect `git diff --stat`, and scan tracked files for secret prefixes. Expected: no whitespace errors and no committed credentials.

- [ ] **Step 4: Commit and deploy**

Commit the reviewed changes, merge the isolated branch to `main` only after final verification, push GitHub, monitor Hostinger build logs, and require HTTP 200 plus healthy protected-route behavior.
