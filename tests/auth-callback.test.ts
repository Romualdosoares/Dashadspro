import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServerClient,
  createAdminClient,
  encryptSecret,
  cookies,
  exchangeCodeForSession,
  upsert,
} = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  encryptSecret: vi.fn(),
  cookies: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));
vi.mock("@/lib/secret-storage", () => ({ encryptSecret }));
vi.mock("@/lib/site-url", () => ({
  resolveSiteOrigin: () => "https://dashadspro.cloud",
}));
vi.mock("next/headers", () => ({ cookies }));

import { GET } from "../app/api/auth/callback/route";

describe("Facebook OAuth callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    cookies.mockResolvedValue({
      getAll: vi.fn(() => []),
    });
    createServerClient.mockReturnValue({
      auth: { exchangeCodeForSession },
    });
    createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });
    encryptSecret.mockResolvedValue("encrypted-token");
    upsert.mockResolvedValue({ error: null });
  });

  it("stores the Facebook token when an email user connects Facebook", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        session: { provider_token: "facebook-token" },
        user: {
          id: "user-1",
          app_metadata: { provider: "email", providers: ["email", "facebook"] },
          user_metadata: { provider_id: "facebook-user-1" },
        },
      },
      error: null,
    });

    const response = await GET(new Request("https://dashadspro.cloud/api/auth/callback?code=oauth-code"));

    expect(encryptSecret).toHaveBeenCalledWith(expect.anything(), "facebook-token");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        facebook_user_id: "facebook-user-1",
        access_token_encrypted: "encrypted-token",
      }),
      { onConflict: "user_id" },
    );
    expect(response.headers.get("location")).toBe("https://dashadspro.cloud/select-account");
  });
});
