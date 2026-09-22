"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Building2, Check, LoaderCircle, RefreshCw, Save, UsersRound } from "lucide-react";
import AdminShell from "../AdminShell";
import { applyFeatureSelection } from "@/lib/admin-feature-ui-state";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/feature-catalog";

type Organization = {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
};

type CatalogFeature = {
  id: string;
  key: string;
  name: string;
  description: string;
  position: number;
  status: "active" | "archived";
};

function parseError(value: unknown, fallback: string) {
  return value instanceof Error ? value.message : fallback;
}

function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEYS.includes(value as FeatureKey);
}

export default function AdminClientsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [features, setFeatures] = useState<CatalogFeature[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<FeatureKey[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const featureRequest = useRef(0);

  const loadOrganizations = useCallback(async () => {
    setLoadingOrganizations(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/organizations");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os clientes.");
      const nextOrganizations = Array.isArray(body.organizations) ? body.organizations : [];
      setOrganizations(nextOrganizations);
      setSelectedOrganizationId((current) => (
        nextOrganizations.some((organization: Organization) => organization.id === current)
          ? current
          : nextOrganizations[0]?.id ?? ""
      ));
    } catch (loadError) {
      setError(parseError(loadError, "Não foi possível carregar os clientes."));
      setOrganizations([]);
      setSelectedOrganizationId("");
    } finally {
      setLoadingOrganizations(false);
    }
  }, []);

  const loadFeatures = useCallback(async (organizationId: string) => {
    if (!organizationId) {
      setFeatures([]);
      setSelectedKeys([]);
      return;
    }
    const request = ++featureRequest.current;
    setLoadingFeatures(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/organizations/${organizationId}/features`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar as features do cliente.");
      if (featureRequest.current !== request) return;
      setFeatures(Array.isArray(body.features) ? body.features : []);
      setSelectedKeys(Array.isArray(body.enabledFeatureKeys)
        ? body.enabledFeatureKeys.filter((key: unknown): key is FeatureKey => typeof key === "string" && isFeatureKey(key))
        : []);
    } catch (loadError) {
      if (featureRequest.current !== request) return;
      setError(parseError(loadError, "Não foi possível carregar as features do cliente."));
      setFeatures([]);
      setSelectedKeys([]);
    } finally {
      if (featureRequest.current === request) setLoadingFeatures(false);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    void loadFeatures(selectedOrganizationId);
  }, [loadFeatures, selectedOrganizationId]);

  async function save() {
    if (!selectedOrganizationId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/organizations/${selectedOrganizationId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureKeys: selectedKeys }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar o acesso do cliente.");
      setSelectedKeys(Array.isArray(body.featureKeys) ? body.featureKeys : selectedKeys);
      setSuccess("Acesso do cliente atualizado.");
    } catch (saveError) {
      setError(parseError(saveError, "Não foi possível salvar o acesso do cliente."));
    } finally {
      setSaving(false);
    }
  }

  const selectedOrganization = organizations.find(({ id }) => id === selectedOrganizationId);

  return (
    <AdminShell
      title="Clientes"
      description="Defina o conjunto completo de features disponível para cada organização."
    >
      <section className="border border-[#242824] bg-[#0A0B0A] p-4" aria-labelledby="organization-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="grid min-w-0 flex-1 gap-2 text-xs text-[#A5ADA5]">
            <span id="organization-title">Organização</span>
            <select
              value={selectedOrganizationId}
              onChange={(event) => setSelectedOrganizationId(event.target.value)}
              disabled={loadingOrganizations || saving || organizations.length === 0}
              className="min-h-11 w-full border border-[#303630] bg-[#050505] px-3 text-sm text-white outline-none focus:border-[#39FF14] disabled:opacity-50"
            >
              {organizations.length === 0 ? <option value="">Nenhuma organização</option> : null}
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadOrganizations()}
            disabled={loadingOrganizations || saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#303630] px-3 text-xs hover:border-[#39FF14] hover:text-[#39FF14] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loadingOrganizations ? "animate-spin" : ""} aria-hidden="true" />
            Atualizar clientes
          </button>
        </div>
        {selectedOrganization ? (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#202420] pt-3 text-xs text-[#7C847C]">
            <span>{selectedOrganization.slug}</span>
            <span>{selectedOrganization.memberCount} {selectedOrganization.memberCount === 1 ? "membro" : "membros"}</span>
          </div>
        ) : null}
      </section>

      {error ? (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 border border-rose-500/50 bg-rose-950/20 p-3 text-sm text-rose-300">
          <AlertCircle size={16} aria-hidden="true" />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => selectedOrganizationId ? void loadFeatures(selectedOrganizationId) : void loadOrganizations()}
            className="min-h-11 border border-rose-500/50 px-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14]"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {success ? (
        <p role="status" className="mt-4 flex items-center gap-2 border border-[#39FF14]/40 bg-[#39FF14]/5 p-3 text-sm text-[#39FF14]">
          <Check size={16} aria-hidden="true" /> {success}
        </p>
      ) : null}

      {loadingOrganizations || loadingFeatures ? (
        <div className="mt-4 flex min-h-40 items-center justify-center gap-3 border border-[#242824] text-sm text-[#8B938B]" role="status">
          <LoaderCircle size={18} className="animate-spin text-[#39FF14]" aria-hidden="true" />
          {loadingOrganizations ? "Carregando clientes..." : "Carregando features do cliente..."}
        </div>
      ) : null}

      {!loadingOrganizations && organizations.length === 0 && !error ? (
        <div className="mt-4 border border-[#242824] p-8 text-center text-sm text-[#8B938B]">
          <Building2 size={22} className="mx-auto mb-3 text-[#39FF14]" aria-hidden="true" />
          Nenhuma organização cadastrada.
        </div>
      ) : null}

      {!loadingOrganizations && !loadingFeatures && selectedOrganization && features.length === 0 && !error ? (
        <div className="mt-4 border border-[#242824] p-8 text-center text-sm text-[#8B938B]">
          <UsersRound size={22} className="mx-auto mb-3 text-[#39FF14]" aria-hidden="true" />
          Nenhuma feature disponível no catálogo.
        </div>
      ) : null}

      {!loadingFeatures && features.length > 0 ? (
        <section className="mt-4 border border-[#242824] bg-[#0A0B0A] p-4" aria-labelledby="client-features-title">
          <div className="flex flex-col gap-3 border-b border-[#202420] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="client-features-title" className="text-sm font-semibold text-white">Features liberadas</h2>
              <p className="mt-1 text-xs text-[#7C847C]">Marque somente os módulos contratados por esta organização.</p>
            </div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#39FF14] bg-[#39FF14] px-4 text-xs font-semibold text-black hover:bg-transparent hover:text-[#39FF14] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
            >
              {saving ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              {saving ? "Salvando..." : "Salvar acesso"}
            </button>
          </div>

          <fieldset className="mt-4 grid gap-2" disabled={saving}>
            <legend className="sr-only">Features disponíveis para {selectedOrganization?.name}</legend>
            {features.map((feature) => {
              const featureKey = isFeatureKey(feature.key) ? feature.key : null;
              const checked = featureKey !== null && selectedKeys.includes(featureKey);
              const disabled = feature.status !== "active" || featureKey === null;
              return (
                <label key={feature.id} className={`flex min-h-14 items-start gap-3 border p-3 ${disabled ? "border-[#202420] opacity-55" : "border-[#303630] hover:border-[#39FF14]/60"}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) => {
                      if (!featureKey) return;
                      setSuccess(null);
                      setSelectedKeys((current) => applyFeatureSelection(current, featureKey, event.target.checked));
                    }}
                    aria-label={`${checked ? "Remover" : "Liberar"} ${feature.name} para ${selectedOrganization?.name}`}
                    className="mt-0.5 size-5 accent-[#39FF14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#39FF14]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                      {feature.name}
                      {feature.status === "archived" ? <span className="border border-[#454B45] px-1.5 py-0.5 text-[9px] uppercase text-[#A5ADA5]">Arquivada</span> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#8B938B]">{feature.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </section>
      ) : null}
    </AdminShell>
  );
}
