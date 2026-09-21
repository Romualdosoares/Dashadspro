export type ManageType = "campaign" | "adset" | "ad";
export type ManageAction = "status" | "daily_budget" | "lifetime_budget";

export type ManagePayload = {
  type: ManageType;
  id: string;
  action: ManageAction;
  value: string | number;
};

type ValidationResult =
  | { ok: true; value: ManagePayload }
  | { ok: false; error: string };

const ALLOWED_TYPES = new Set<ManageType>(["campaign", "adset", "ad"]);
const ALLOWED_ACTIONS = new Set<ManageAction>([
  "status",
  "daily_budget",
  "lifetime_budget",
]);
const ALLOWED_STATUSES = new Set(["ACTIVE", "PAUSED", "ARCHIVED"]);
const ALLOWED_PRESETS = new Set([
  "today",
  "yesterday",
  "last_3d",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
]);
const DAY_MS = 24 * 60 * 60 * 1000;

export function validateManagePayload(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Parâmetros inválidos" };
  }

  const candidate = input as Record<string, unknown>;
  const type = candidate.type;
  const id = String(candidate.id ?? "");
  const action = candidate.action;
  const value = candidate.value;

  if (!ALLOWED_TYPES.has(type as ManageType)) {
    return { ok: false, error: "Tipo inválido" };
  }
  if (!ALLOWED_ACTIONS.has(action as ManageAction)) {
    return { ok: false, error: "Ação inválida" };
  }
  if (!/^\d+$/.test(id)) {
    return { ok: false, error: "ID inválido" };
  }

  if (type === "ad" && action !== "status") {
    return {
      ok: false,
      error: "Orçamento só pode ser alterado em campanhas e conjuntos de anúncios",
    };
  }

  if (action === "status") {
    if (!ALLOWED_STATUSES.has(String(value))) {
      return { ok: false, error: "Status inválido" };
    }
  } else {
    const budget = Number(value);
    if (!Number.isFinite(budget) || budget <= 0) {
      return {
        ok: false,
        error: "Orçamento inválido. Informe um valor maior que zero.",
      };
    }
  }

  return {
    ok: true,
    value: {
      type: type as ManageType,
      id,
      action: action as ManageAction,
      value: value as string | number,
    },
  };
}

export function parseAccountIds(raw: string | null): string[] {
  if (!raw) return [];

  const ids = [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
  if (ids.length > 25) {
    throw new Error("No máximo 25 contas podem ser consultadas por vez");
  }
  if (ids.some((id) => !/^(?:act_)?\d+$/.test(id))) {
    throw new Error("ID de conta inválido");
  }
  return ids;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Data inválida");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
    throw new Error("Data inválida");
  }
  return date;
}

export function parseDateSelection(
  rawPreset: string,
  since: string | null,
  until: string | null,
): string {
  if (since || until) {
    if (!since || !until) throw new Error("Informe as duas datas do intervalo");
    const start = parseIsoDate(since);
    const end = parseIsoDate(until);
    if (start > end) throw new Error("Intervalo de datas inválido");
    const inclusiveDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
    if (inclusiveDays > 366) throw new Error("Intervalo máximo de 366 dias");
    return `custom:${since}:${until}`;
  }

  if (!ALLOWED_PRESETS.has(rawPreset)) throw new Error("Período inválido");
  return rawPreset;
}

function currentRange(preset: string, now: Date): [Date, Date] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (preset === "today") return [today, today];
  if (preset === "yesterday") {
    const yesterday = addDays(today, -1);
    return [yesterday, yesterday];
  }

  const daysMatch = /^last_(3|7|14|30|90)d$/.exec(preset);
  if (daysMatch) {
    const days = Number(daysMatch[1]);
    const end = addDays(today, -1);
    return [addDays(end, -(days - 1)), end];
  }

  if (preset === "this_month") {
    return [new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), today];
  }
  if (preset === "last_month") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return [start, end];
  }

  throw new Error("Período inválido");
}

export function getPreviousPeriod(preset: string, now = new Date()): string {
  let start: Date;
  let end: Date;

  if (preset.startsWith("custom:")) {
    const [, rawStart, rawEnd] = preset.split(":");
    start = parseIsoDate(rawStart);
    end = parseIsoDate(rawEnd);
    if (start > end) throw new Error("Intervalo de datas inválido");
  } else {
    [start, end] = currentRange(preset, now);
  }

  const durationDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(durationDays - 1));
  return `custom:${formatDate(previousStart)}:${formatDate(previousEnd)}`;
}
