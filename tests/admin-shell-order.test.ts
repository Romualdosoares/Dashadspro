import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("AdminShell navigation order", () => {
  it("renders product links before primary admin links", () => {
    const source = readFileSync(resolve(process.cwd(), "app/admin/AdminShell.tsx"), "utf8");

    expect(source.indexOf("{productLinks.map")).toBeLessThan(source.indexOf("{primaryLinks.map"));
  });
});
