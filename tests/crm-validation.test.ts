import { describe, expect, it } from "vitest";
import { validateLeadCreate, validateLeadStageUpdate, validateLeadUpdatedAt } from "../lib/crm-validation";

describe("validateLeadCreate", () => {
  it("rejects null input without throwing", () => {
    expect(validateLeadCreate(null)).toMatchObject({ ok: false });
  });

  it("rejects array input even when it contains valid lead fields", () => {
    expect(
      validateLeadCreate(
        Object.assign([], {
          name: "Maria",
          source: "manual",
          email: "maria@example.com",
        }),
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects primitive input without throwing", () => {
    expect(validateLeadCreate("Maria")).toMatchObject({ ok: false });
  });

  it("normalizes a valid WhatsApp phone number", () => {
    expect(
      validateLeadCreate({
        name: "Maria Silva",
        phone: "(11) 98888-7777",
        source: "whatsapp",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "Maria Silva",
        phone: "5511988887777",
        email: null,
        source: "whatsapp",
      },
    });
  });

  it("normalizes email whitespace and casing before contact lookup", () => {
    expect(
      validateLeadCreate({
        name: "Maria Silva",
        source: "manual",
        email: "  Maria.Silva@Example.COM ",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "Maria Silva",
        phone: null,
        email: "maria.silva@example.com",
        source: "manual",
      },
    });
  });

  it("rejects names outside the supported length", () => {
    expect(validateLeadCreate({ name: "A", source: "manual", email: "maria@example.com" }).ok).toBe(false);
    expect(
      validateLeadCreate({
        name: "a".repeat(121),
        source: "manual",
        email: "maria@example.com",
      }).ok,
    ).toBe(false);
  });

  it("rejects an unsupported lead source", () => {
    expect(validateLeadCreate({ name: "Maria", source: "import", email: "maria@example.com" }).ok).toBe(false);
  });

  it("requires a phone number or email address", () => {
    expect(validateLeadCreate({ name: "Maria", source: "manual" }).ok).toBe(false);
  });

  it("rejects an invalid email address", () => {
    expect(
      validateLeadCreate({
        name: "Maria",
        source: "landing_page",
        email: "invalid-email",
      }).ok,
    ).toBe(false);
  });

  it("rejects an invalid phone number", () => {
    expect(
      validateLeadCreate({
        name: "Maria",
        source: "manual",
        phone: "9876-5432",
      }).ok,
    ).toBe(false);
  });
});

describe("validateLeadStageUpdate", () => {
  it("rejects a stage ID that is not an RFC 4122 UUID", () => {
    expect(validateLeadStageUpdate("stage-1").ok).toBe(false);
  });

  it("accepts an RFC 4122 UUID stage ID", () => {
    expect(validateLeadStageUpdate("550e8400-e29b-41d4-a716-446655440000")).toEqual({
      ok: true,
      value: "550e8400-e29b-41d4-a716-446655440000",
    });
  });
});

describe("validateLeadUpdatedAt", () => {
  it("requires a valid client snapshot timestamp", () => {
    expect(validateLeadUpdatedAt(undefined).ok).toBe(false);
    expect(validateLeadUpdatedAt("not-a-date").ok).toBe(false);
    expect(validateLeadUpdatedAt("2026-09-22T12:00:00.000Z")).toEqual({
      ok: true,
      value: "2026-09-22T12:00:00.000Z",
    });
  });
});
