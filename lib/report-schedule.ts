export type ReportSchedule = {
  schedule: string;
  schedule_hours: number[] | null;
  schedule_timezone: string | null;
  last_sent_at: string | null;
};

type LocalTime = { hour: number; weekday: string; slot: string };

export function normalizeBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  throw new Error("Telefone brasileiro invalido");
}

function localTime(date: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(value("hour"));
  return {
    hour,
    weekday: value("weekday"),
    slot: `${value("year")}-${value("month")}-${value("day")}-${String(hour).padStart(2, "0")}`,
  };
}

export function isReportDue(config: ReportSchedule, now = new Date()): boolean {
  if (config.schedule !== "daily" && config.schedule !== "weekly") return false;
  const hours = Array.isArray(config.schedule_hours) ? config.schedule_hours : [];
  const timeZone = config.schedule_timezone || "America/Sao_Paulo";

  let current: LocalTime;
  try {
    current = localTime(now, timeZone);
  } catch {
    current = localTime(now, "UTC");
  }

  if (!hours.includes(current.hour)) return false;
  if (config.schedule === "weekly" && current.weekday !== "Mon") return false;

  if (config.last_sent_at) {
    const lastSent = new Date(config.last_sent_at);
    if (!Number.isNaN(lastSent.getTime())) {
      let previous: LocalTime;
      try {
        previous = localTime(lastSent, timeZone);
      } catch {
        previous = localTime(lastSent, "UTC");
      }
      if (previous.slot === current.slot) return false;
    }
  }
  return true;
}
