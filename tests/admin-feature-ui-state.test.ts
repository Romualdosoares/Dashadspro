import { describe, expect, it } from "vitest";
import { applyFeatureSelection } from "../lib/admin-feature-ui-state";

describe("applyFeatureSelection", () => {
  it("adds an enabled feature", () => {
    expect(applyFeatureSelection(["crm"], "dashboard_ads", true)).toEqual([
      "crm",
      "dashboard_ads",
    ]);
  });

  it("removes a disabled feature", () => {
    expect(applyFeatureSelection(["dashboard_ads", "crm"], "crm", false)).toEqual([
      "dashboard_ads",
    ]);
  });

  it("does not add duplicate features", () => {
    expect(applyFeatureSelection(["crm", "crm"], "crm", true)).toEqual(["crm"]);
  });

  it("ignores feature keys outside the server allowlist", () => {
    expect(applyFeatureSelection(["crm"], "billing" as "crm", true)).toEqual(["crm"]);
  });
});
