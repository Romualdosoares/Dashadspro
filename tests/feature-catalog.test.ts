import { describe, expect, it } from "vitest";
import { getFeatureDefinition, parseCatalogFeatureInput } from "../lib/feature-catalog";

describe("parseCatalogFeatureInput", () => {
  it("accepts an allowlisted catalog feature", () => {
    expect(
      parseCatalogFeatureInput({
        key: "crm",
        name: "CRM",
        description: "Funil",
        position: 2,
      }),
    ).toMatchObject({ ok: true });
  });

  it("rejects an unsupported feature key", () => {
    expect(
      parseCatalogFeatureInput({
        key: "unsafe",
        name: "Unsafe",
        description: "Unsafe feature",
        position: 0,
      }),
    ).toEqual({ ok: false, error: "Feature não suportada" });
  });

  it("rejects invalid catalog fields with Portuguese errors", () => {
    expect(parseCatalogFeatureInput(null)).toEqual({ ok: false, error: "Dados da funcionalidade inválidos" });
    expect(parseCatalogFeatureInput({ key: "crm", name: " ", description: "Funil", position: 0 })).toEqual({
      ok: false,
      error: "Nome da funcionalidade é obrigatório",
    });
    expect(parseCatalogFeatureInput({ key: "crm", name: "CRM", description: " ", position: 0 })).toEqual({
      ok: false,
      error: "Descrição da funcionalidade é obrigatória",
    });
    expect(parseCatalogFeatureInput({ key: "crm", name: "CRM", description: "Funil", position: -1 })).toEqual({
      ok: false,
      error: "Posição da funcionalidade deve ser um inteiro maior ou igual a zero",
    });
  });
});

describe("getFeatureDefinition", () => {
  it("returns the fixed dashboard route", () => {
    expect(getFeatureDefinition("dashboard_ads")?.route).toBe("/dashboard");
  });
});
