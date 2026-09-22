import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBusinessAdAccounts, fetchUserAdAccounts } from "../lib/meta-api";

describe("Meta account discovery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("surfaces Graph API errors instead of hiding an expired token as no accounts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { message: "Session expired", code: 190 } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )));

    await expect(fetchUserAdAccounts("token")).rejects.toThrow("Session expired");
  });

  it("includes accounts shared with the business and removes duplicates", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("owned_ad_accounts")) {
        return new Response(JSON.stringify({ data: [{ id: "act_1", name: "Owned" }] }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        data: [
          { id: "act_1", name: "Owned duplicate" },
          { id: "act_2", name: "Client account" },
        ],
      }), { headers: { "Content-Type": "application/json" } });
    }));

    await expect(fetchBusinessAdAccounts("business_1", "token")).resolves.toEqual([
      { id: "act_1", name: "Owned" },
      { id: "act_2", name: "Client account" },
    ]);
  });
});
