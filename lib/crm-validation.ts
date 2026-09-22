import { normalizeBrazilianPhone } from "./report-schedule";
import type { LeadSource } from "./crm-types";

export type LeadCreateValue = {
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
};

export type LeadCreateValidationResult =
  | { ok: true; value: LeadCreateValue }
  | { ok: false; error: string };

export type LeadStageUpdateValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export type LeadUpdatedAtValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const LEAD_SOURCES = new Set<LeadSource>(["manual", "landing_page", "whatsapp"]);
const BASIC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RFC4122_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

export function validateLeadCreate(input: unknown): LeadCreateValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: "Parametros invalidos" };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: "Nome invalido" };
  }

  if (!LEAD_SOURCES.has(input.source as LeadSource)) {
    return { ok: false, error: "Origem invalida" };
  }

  if (input.phone != null && typeof input.phone !== "string") {
    return { ok: false, error: "Telefone invalido" };
  }
  const rawPhone = typeof input.phone === "string" ? input.phone.trim() : "";
  let phone: string | null = null;
  if (rawPhone) {
    try {
      phone = normalizeBrazilianPhone(rawPhone);
    } catch {
      return { ok: false, error: "Telefone invalido" };
    }
  }

  if (input.email != null && typeof input.email !== "string") {
    return { ok: false, error: "Email invalido" };
  }
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email && !BASIC_EMAIL.test(email)) {
    return { ok: false, error: "Email invalido" };
  }

  if (!phone && !email) {
    return { ok: false, error: "Informe telefone ou email" };
  }

  return {
    ok: true,
    value: {
      name,
      phone,
      email: email || null,
      source: input.source as LeadSource,
    },
  };
}

export function validateLeadStageUpdate(input: unknown): LeadStageUpdateValidationResult {
  if (typeof input !== "string" || !RFC4122_UUID.test(input)) {
    return { ok: false, error: "Estagio invalido" };
  }

  return { ok: true, value: input };
}

export function validateLeadUpdatedAt(input: unknown): LeadUpdatedAtValidationResult {
  if (typeof input !== "string" || Number.isNaN(Date.parse(input))) {
    return { ok: false, error: "Atualizacao invalida" };
  }

  return { ok: true, value: input };
}
