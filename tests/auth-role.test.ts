import { describe, expect, it } from "vitest";
import { getPlatformRole, isPlatformAdmin } from "../lib/auth-role";

describe("getPlatformRole", () => {
  it("uses admin role from app metadata even when user metadata differs", () => {
    expect(
      getPlatformRole({
        app_metadata: { role: "admin" },
        user_metadata: { role: "user" },
      }),
    ).toBe("admin");
  });

  it("returns user when app metadata role is unknown", () => {
    expect(
      getPlatformRole({
        app_metadata: { role: "manager" },
        user_metadata: { role: "admin" },
      }),
    ).toBe("user");
  });

  it("does not grant admin from inherited metadata claims", () => {
    expect(
      getPlatformRole(Object.create({ app_metadata: { role: "admin" } })),
    ).toBe("user");

    expect(
      getPlatformRole({ app_metadata: Object.create({ role: "admin" }) }),
    ).toBe("user");
  });

  it("does not authorize inherited app metadata roles", () => {
    expect(isPlatformAdmin({ app_metadata: Object.create({ role: "admin" }) })).toBe(false);
  });
});
