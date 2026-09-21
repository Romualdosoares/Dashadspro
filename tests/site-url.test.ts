import { describe, expect, it } from "vitest";
import { resolveSiteOrigin } from "../lib/site-url";

describe("site origin", () => {
  it("prefers the configured canonical site over the request host", () => {
    expect(resolveSiteOrigin("https://attacker.example/api/auth/facebook", "https://dashadspro.cloud/path"))
      .toBe("https://dashadspro.cloud");
  });

  it("falls back to the request origin when configuration is absent", () => {
    expect(resolveSiteOrigin("http://localhost:3000/login", "")).toBe("http://localhost:3000");
  });

  it("ignores an invalid configured URL", () => {
    expect(resolveSiteOrigin("http://localhost:3000/login", "not-a-url")).toBe("http://localhost:3000");
  });
});
