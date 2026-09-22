# CRM RLS integration test

`tests/crm-rls.integration.test.ts` is disabled unless every variable below is set. It only targets a disposable Supabase project with `supabase-crm-phase-1.sql` already applied.

```text
SUPABASE_RLS_TEST_URL
SUPABASE_RLS_TEST_ANON_KEY
SUPABASE_RLS_TEST_SERVICE_ROLE_KEY
```

Run only against that disposable project:

```bash
npm test -- tests/crm-rls.integration.test.ts
```

The test creates random users, organizations, memberships, CRM contacts, Facebook tokens, and ad accounts. It authenticates separate anon clients to prove cross-organization denial, shared-membership access, and `app_metadata.role=admin` bypass. Service-role access is used only for test setup and cleanup; app runtime never uses it. Do not set these variables to production credentials.
