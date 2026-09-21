import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdAccountInsights } from "../lib/meta-api";

describe("Meta API errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects API failures instead of returning fake zero data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { message: "token expired", code: 190 } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )));

    await expect(fetchAdAccountInsights("act_123", "token", "today"))
      .rejects.toThrow("token expired");
  });
});
