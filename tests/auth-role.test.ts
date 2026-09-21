import { describe, expect, it } from "vitest";
import { getPlatformRole } from "../lib/auth-role";

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
});
