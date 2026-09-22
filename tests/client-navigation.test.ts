import { describe, expect, it } from "vitest";
import { getClientNavigation } from "../lib/client-navigation";

describe("getClientNavigation", () => {
  it("uses registry order and fixed links", () => {
    expect(getClientNavigation(["crm", "dashboard_ads"])).toEqual([
      expect.objectContaining({ key: "dashboard_ads", href: "/dashboard" }),
      expect.objectContaining({ key: "crm", href: "/crm" }),
    ]);
  });

  it("removes duplicate and invalid keys", () => {
    expect(getClientNavigation(["crm", "invalid", "crm"])).toEqual([
      expect.objectContaining({ key: "crm", href: "/crm" }),
    ]);
  });
});
