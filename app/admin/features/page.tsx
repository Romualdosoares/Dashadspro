"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Archive, Check, LoaderCircle, RefreshCw, Save, Settings2 } from "lucide-react";
import AdminShell from "../AdminShell";

type CatalogFeature = {
  id: string;
  key: string;
  name: string;
  description: string;
  position: number;
  status: "active" | "archived";
};

function errorMessage(value: unknown, fallback: string) {
  return value instanceof Error ? value.message : fallback;
}

export default function AdminFeaturesPage() {
  const [features, setFeatures] = useState<CatalogFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/features");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar as features.");
      setFeatures(Array.isArray(body.features) ? body.features : []);
    } catch (loadError) {
      setError(errorMessage(loadError, "Não foi possível carregar as features."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFeature(key: string, field: "name" | "description" | "position", value: string) {
    setSuccess(null);
    setFeatures((current) => current.map((feature) => feature.key === key
      ? { ...feature, [field]: field === "position" ? Number(value) : value }
      : feature));
  }

  async function save(feature: CatalogFeature, status?: "archived") {
    if (status === "archived" && !window.confirm(`Arquivar ${feature.name}? Clientes deixarão de receber esta feature.`)) {
      return;
    }

    setSavingKey(feature.key);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/features", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: feature.key,
          name: feature.name,
          description: feature.description,
          position: feature.position,
          ...(status ? { status } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar a feature.");
      setFeatures((current) => current.map((item) => item.key === feature.key ? body.feature : item));
      setSuccess(status === "archived" ? "Feature arquivada." : "Feature atualizada.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Não foi possível salvar a feature."));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <AdminShell
      title="Features"
      description="Edite informações seguras do catálogo e desative módulos disponíveis para clientes."
    >
      <div className="mb-4 border border-[#303630] bg-[#0A0B0A] p-4 text-xs leading-5 text-[#A5ADA5]">
        <p className="font-semibold text-white">Ativação controlada pelo servidor</p>
        <p className="mt-1">Uma nova implementação precisa existir na allowlist do servidor antes de ser ativada. Rotas e ícones não são editáveis aqui.</p>
      </div>

      {error ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 border border-rose-500/50 bg-rose-950/20 p-3 text-sm text-rose-300">
          <AlertCircle size={16} aria-hidden="true" />
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => void load()} className="min-h-11 border border-rose-500/50 px-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14]">
            Tentar novamente
          </button>
        </div>
      ) : null}

      {success ? (
        <p role="status" className="mb-4 flex items-center gap-2 border border-[#39FF14]/40 bg-[#39FF14]/5 p-3 text-sm text-[#39FF14]">
          <Check size={16} aria-hidden="true" /> {success}
        </p>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[#7C847C]">{features.length} {features.length === 1 ? "feature" : "features"}</p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 border border-[#2B302B] px-3 text-xs hover:border-[#39FF14] hover:text-[#39FF14] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-3 border border-[#242824] text-sm text-[#8B938B]" role="status">
          <LoaderCircle size={18} className="animate-spin text-[#39FF14]" aria-hidden="true" />
          Carregando features...
        </div>
      ) : null}

      {!loading && !error && features.length === 0 ? (
        <div className="border border-[#242824] p-8 text-center text-sm text-[#8B938B]">
          <Settings2 size={22} className="mx-auto mb-3 text-[#39FF14]" aria-hidden="true" />
          Nenhuma feature cadastrada.
        </div>
      ) : null}

      {!loading && features.length > 0 ? (
        <div className="grid gap-3">
          {features.map((feature) => {
            const saving = savingKey === feature.key;
            return (
              <section key={feature.id} className="border border-[#242824] bg-[#0A0B0A] p-4" aria-labelledby={`feature-${feature.key}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202420] pb-3">
                  <div>
                    <h2 id={`feature-${feature.key}`} className="text-sm font-semibold text-white">{feature.key}</h2>
                    <p className="mt-1 text-[11px] text-[#717971]">Chave imutável</p>
                  </div>
                  <span className={`border px-2 py-1 text-[10px] uppercase tracking-wide ${feature.status === "active" ? "border-[#39FF14]/50 text-[#39FF14]" : "border-[#454B45] text-[#A5ADA5]"}`}>
                    {feature.status === "active" ? "Ativa" : "Arquivada"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(180px,0.8fr)_minmax(240px,1.5fr)_120px]">
                  <label className="grid gap-2 text-xs text-[#A5ADA5]">
                    Nome
                    <input
                      value={feature.name}
                      onChange={(event) => updateFeature(feature.key, "name", event.target.value)}
                      disabled={saving}
                      className="min-h-11 border border-[#303630] bg-[#050505] px-3 text-sm text-white outline-none focus:border-[#39FF14] disabled:opacity-50"
                    />
                  </label>
                  <label className="grid gap-2 text-xs text-[#A5ADA5]">
                    Descrição
                    <input
                      value={feature.description}
                      onChange={(event) => updateFeature(feature.key, "description", event.target.value)}
                      disabled={saving}
                      className="min-h-11 border border-[#303630] bg-[#050505] px-3 text-sm text-white outline-none focus:border-[#39FF14] disabled:opacity-50"
                    />
                  </label>
                  <label className="grid gap-2 text-xs text-[#A5ADA5]">
                    Posição
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={feature.position}
                      onChange={(event) => updateFeature(feature.key, "position", event.target.value)}
                      disabled={saving}
                      className="min-h-11 border border-[#303630] bg-[#050505] px-3 text-sm text-white outline-none focus:border-[#39FF14] disabled:opacity-50"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {feature.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => void save(feature, "archived")}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center gap-2 border border-rose-500/50 px-3 text-xs text-rose-300 hover:bg-rose-950/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] disabled:opacity-50"
                    >
                      <Archive size={14} aria-hidden="true" />
                      Arquivar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void save(feature)}
                    disabled={saving}
                    className="inline-flex min-h-11 items-center gap-2 border border-[#39FF14] bg-[#39FF14] px-3 text-xs font-semibold text-black hover:bg-transparent hover:text-[#39FF14] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                  >
                    {saving ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </AdminShell>
  );
}
