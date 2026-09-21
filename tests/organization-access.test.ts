import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  pickActiveOrganization,
  requireActiveOrganization,
} from "../lib/organization-access";

describe("pickActiveOrganization", () => {
  it("chooses an owner organization before an agent organization", () => {
    expect(
      pickActiveOrganization([
        { organization_id: "agent-org", role: "agent" },
        { organization_id: "owner-org", role: "owner" },
      ]),
    ).toBe("owner-org");
  });

  it("chooses a manager organization before an agent organization", () => {
    expect(
      pickActiveOrganization([
        { organization_id: "agent-org", role: "agent" },
        { organization_id: "manager-org", role: "manager" },
      ]),
    ).toBe("manager-org");
  });

  it("chooses smallest owner ID when owner memberships arrive out of order", () => {
    expect(
      pickActiveOrganization([
        { organization_id: "owner-9f2", role: "owner" },
        { organization_id: "owner-103", role: "owner" },
      ]),
    ).toBe("owner-103");
  });

  it("returns null when membership list is empty", () => {
    expect(pickActiveOrganization([])).toBeNull();
  });

  it("uses agent organization when no higher role exists", () => {
    expect(
      pickActiveOrganization([{ organization_id: "agent-org", role: "agent" }]),
    ).toBe("agent-org");
  });
});

describe("requireActiveOrganization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null user and organization for unauthenticated requests", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    createClient.mockResolvedValue(supabase);

    await expect(requireActiveOrganization()).resolves.toEqual({
      supabase,
      user: null,
      organizationId: null,
    });
  });

  it("throws when authentication validation fails", async () => {
    const authError = new Error("session validation failed");
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: authError,
        }),
      },
    };
    createClient.mockResolvedValue(supabase);

    const error = await requireActiveOrganization().catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) {
      throw error;
    }

    expect(error.message).toBe("Não foi possível validar autenticação");
    expect(error.cause).toBe(authError);
  });

  it("loads memberships for authenticated user and returns highest-priority organization", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { organization_id: "agent-org", role: "agent" },
        { organization_id: "manager-org", role: "manager" },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const user = { id: "user-1" };
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from,
    };
    createClient.mockResolvedValue(supabase);

    await expect(requireActiveOrganization()).resolves.toEqual({
      supabase,
      user,
      organizationId: "manager-org",
    });
    expect(from).toHaveBeenCalledWith("organization_memberships");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(order).toHaveBeenCalledWith("organization_id", { ascending: true });
  });

  it("throws a readable error when membership query fails", async () => {
    const order = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("database unavailable"),
    });
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order })) })) })),
    };
    createClient.mockResolvedValue(supabase);

    await expect(requireActiveOrganization()).rejects.toThrow(
      "Could not load organization memberships: database unavailable",
    );
  });
});
