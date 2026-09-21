import { describe, expect, it } from "vitest";
import {
  getPreviousPeriod,
  parseAccountIds,
  parseDateSelection,
  validateManagePayload,
} from "../lib/meta-validation";

describe("validateManagePayload", () => {
  it("rejects actions outside the exact runtime allowlist", () => {
    expect(
      validateManagePayload({
        type: "adset",
        id: "123",
        action: "bid_amount",
        value: 5,
      }),
    ).toEqual({ ok: false, error: "Ação inválida" });
  });

  it("rejects budget changes for individual ads", () => {
    expect(
      validateManagePayload({
        type: "ad",
        id: "123",
        action: "daily_budget",
        value: 10,
      }),
    ).toEqual({
      ok: false,
      error: "Orçamento só pode ser alterado em campanhas e conjuntos de anúncios",
    });
  });

  it("accepts a valid status change", () => {
    expect(
      validateManagePayload({
        type: "campaign",
        id: "123",
        action: "status",
        value: "PAUSED",
      }),
    ).toEqual({
      ok: true,
      value: { type: "campaign", id: "123", action: "status", value: "PAUSED" },
    });
  });
});

describe("parseAccountIds", () => {
  it("deduplicates valid account IDs", () => {
    expect(parseAccountIds("act_123,act_123,456")).toEqual(["act_123", "456"]);
  });

  it("rejects invalid IDs and fan-out over 25 accounts", () => {
    expect(() => parseAccountIds("act_1,not-an-id")).toThrow("ID de conta inválido");
    expect(() =>
      parseAccountIds(Array.from({ length: 26 }, (_, index) => `act_${index + 1}`).join(",")),
    ).toThrow("No máximo 25 contas");
  });
});

describe("date selection", () => {
  it("rejects impossible, reversed, and oversized custom ranges", () => {
    expect(() => parseDateSelection("last_30d", "2026-02-30", "2026-03-01")).toThrow(
      "Data inválida",
    );
    expect(() => parseDateSelection("last_30d", "2026-03-02", "2026-03-01")).toThrow(
      "Intervalo de datas inválido",
    );
    expect(() => parseDateSelection("last_30d", "2024-01-01", "2026-01-02")).toThrow(
      "Intervalo máximo",
    );
  });

  it("rejects unknown presets", () => {
    expect(() => parseDateSelection("forever", null, null)).toThrow("Período inválido");
  });

  it("builds a previous custom period with the same inclusive duration", () => {
    expect(getPreviousPeriod("custom:2026-09-10:2026-09-12")).toBe(
      "custom:2026-09-07:2026-09-09",
    );
  });

  it("builds an equal three-day previous period", () => {
    expect(getPreviousPeriod("last_3d", new Date("2026-09-21T12:00:00Z"))).toBe(
      "custom:2026-09-15:2026-09-17",
    );
  });
});
