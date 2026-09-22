import { describe, expect, it } from "vitest";

import { GET as getContext } from "../app/api/crm/context/route";
import { GET as getLeads } from "../app/api/crm/leads/route";

type Assert<T extends true> = T;
type HasRequiredRequest<Handler extends (...args: never[]) => unknown> =
  Parameters<Handler> extends [Request] ? true : false;

type ContextGetUsesRequiredRequest = Assert<HasRequiredRequest<typeof getContext>>;
type LeadsGetUsesRequiredRequest = Assert<HasRequiredRequest<typeof getLeads>>;

describe("CRM route contracts", () => {
  it("exports GET handlers with a required Request argument", () => {
    expect(true).toBe(true);
  });
});
