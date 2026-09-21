import { describe, expect, it } from "vitest";
import { isReportDue, normalizeBrazilianPhone } from "../lib/report-schedule";

const mondayAt11Brt = new Date("2026-09-21T14:00:00.000Z");

describe("report scheduling", () => {
  it("uses the configured local hour without a second UTC conversion", () => {
    expect(isReportDue({ schedule: "daily", schedule_hours: [11], schedule_timezone: "America/Sao_Paulo", last_sent_at: null }, mondayAt11Brt)).toBe(true);
  });

  it("runs weekly reports only on Monday", () => {
    expect(isReportDue({ schedule: "weekly", schedule_hours: [11], schedule_timezone: "America/Sao_Paulo", last_sent_at: null }, mondayAt11Brt)).toBe(true);
    expect(isReportDue({ schedule: "weekly", schedule_hours: [11], schedule_timezone: "America/Sao_Paulo", last_sent_at: null }, new Date("2026-09-22T14:00:00.000Z"))).toBe(false);
  });

  it("does not send twice in the same local hour", () => {
    expect(isReportDue({ schedule: "daily", schedule_hours: [11], schedule_timezone: "America/Sao_Paulo", last_sent_at: "2026-09-21T14:10:00.000Z" }, mondayAt11Brt)).toBe(false);
  });

  it("never schedules manual reports", () => {
    expect(isReportDue({ schedule: "manual", schedule_hours: [11], schedule_timezone: "America/Sao_Paulo", last_sent_at: null }, mondayAt11Brt)).toBe(false);
  });
});

describe("Brazilian phone normalization", () => {
  it("adds country code to DDD numbers", () => {
    expect(normalizeBrazilianPhone("(11) 98765-4321")).toBe("5511987654321");
  });

  it("preserves an existing Brazilian country code", () => {
    expect(normalizeBrazilianPhone("+55 11 98765-4321")).toBe("5511987654321");
  });

  it("rejects incomplete numbers", () => {
    expect(() => normalizeBrazilianPhone("9876-5432")).toThrow("invalido");
  });
});
