export const FEATURE_KEYS = ["dashboard_ads", "crm", "site_builder"] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureDefinition = Readonly<{
  key: FeatureKey;
  route: string;
  icon: string;
  defaultName: string;
}>;

export type CatalogFeatureInput = Readonly<{
  key: FeatureKey;
  name: string;
  description: string;
  position: number;
}>;

export type CatalogFeatureParseResult =
  | Readonly<{ ok: true; value: CatalogFeatureInput }>
  | Readonly<{ ok: false; error: string }>;

const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = Object.freeze([
  Object.freeze({
    key: "dashboard_ads",
    route: "/dashboard",
    icon: "BarChart3",
    defaultName: "Dashboard Ads",
  }),
  Object.freeze({
    key: "crm",
    route: "/crm",
    icon: "UsersRound",
    defaultName: "CRM",
  }),
  Object.freeze({
    key: "site_builder",
    route: "/sites",
    icon: "PanelsTopLeft",
    defaultName: "Criador de Sites",
  }),
]);

function isFeatureKey(key: string): key is FeatureKey {
  return FEATURE_KEYS.includes(key as FeatureKey);
}

export function getFeatureDefinition(key: string): FeatureDefinition | null {
  return FEATURE_DEFINITIONS.find((definition) => definition.key === key) ?? null;
}

export function parseCatalogFeatureInput(input: unknown): CatalogFeatureParseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Dados da funcionalidade inválidos" };
  }

  const { key, name, description, position } = input as Record<string, unknown>;

  if (typeof key !== "string" || !isFeatureKey(key)) {
    return { ok: false, error: "Feature não suportada" };
  }

  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "Nome da funcionalidade é obrigatório" };
  }

  if (typeof description !== "string" || description.trim().length === 0) {
    return { ok: false, error: "Descrição da funcionalidade é obrigatória" };
  }

  if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
    return { ok: false, error: "Posição da funcionalidade deve ser um inteiro maior ou igual a zero" };
  }

  return {
    ok: true,
    value: {
      key,
      name: name.trim(),
      description: description.trim(),
      position,
    },
  };
}
