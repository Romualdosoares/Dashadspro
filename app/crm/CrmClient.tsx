"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, LayoutDashboard, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import {
  PipelineRequestTracker,
  addMovingLead,
  getMoveLeadAriaLabel,
  getCrmPipelineViewLabels,
  isLeadFormDisabled,
  loadCrmPipeline,
  removeMovingLead,
  requestLeadMove,
  submitCrmLead,
} from "@/lib/crm-client-state";
import { buildPipelineColumns } from "@/lib/crm-pipeline";
import type { CrmLead, CrmStage, LeadSource } from "@/lib/crm-types";

const sourceLabels: Record<LeadSource, string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  landing_page: "Landing page",
};

export default function CrmClient({
  userName,
  userEmail,
}: {
  userName: string;
  userEmail: string | null;
}) {
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [movingLeadIds, setMovingLeadIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<LeadSource>("manual");
  const pipelineRequests = useRef(new PipelineRequestTracker());

  const loadPipeline = useCallback(async () => {
    const requestGeneration = pipelineRequests.current.start();
    setLoading(true);
    setError(null);

    try {
      const pipeline = await loadCrmPipeline(fetch);
      if (!pipelineRequests.current.isCurrent(requestGeneration)) return;
      setStages(pipeline.stages);
      setLeads(pipeline.leads);
    } catch (loadError) {
      if (!pipelineRequests.current.isCurrent(requestGeneration)) return;
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o CRM.");
    } finally {
      if (pipelineRequests.current.isCurrent(requestGeneration)) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPipeline();
  }, [loadPipeline]);

  const columns = useMemo(() => buildPipelineColumns(stages, leads), [stages, leads]);
  const viewLabels = getCrmPipelineViewLabels({ loading, error, columnCount: columns.length });
  const submitDisabled = isLeadFormDisabled({ loading, saving });

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitDisabled) return;
    setError(null);

    if (!phone.trim() && !email.trim()) {
      setError("Informe WhatsApp ou email para criar o lead.");
      return;
    }

    setSaving(true);
    try {
      await submitCrmLead(
        fetch,
        { name, phone, email, source },
        async (resetForm) => {
          setName(resetForm.name);
          setPhone(resetForm.phone);
          setEmail(resetForm.email);
          setSource(resetForm.source);
          await loadPipeline();
        },
      );
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o lead.");
    } finally {
      setSaving(false);
    }
  }

  async function moveLead(leadId: string, stageId: string) {
    setError(null);
    setMovingLeadIds((currentLeadIds) => addMovingLead(currentLeadIds, leadId));

    try {
      await requestLeadMove(fetch, leadId, stageId, (updatedLeadId, updatedStageId) => {
        setLeads((currentLeads) => currentLeads.map((lead) => (
          lead.id === updatedLeadId ? { ...lead, stage_id: updatedStageId } : lead
        )));
      });
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Não foi possível mover o lead.");
    } finally {
      setMovingLeadIds((currentLeadIds) => removeMovingLead(currentLeadIds, leadId));
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0C0A] font-mono text-[#E8EDE8]">
      <div className="mx-auto max-w-[1680px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex flex-col gap-4 border border-[#2A2F2A] bg-[#10120F] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#00E676]">CRM</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">Pipeline de leads</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#AAB2AA]">
            <span>{userName}</span>
            {userEmail ? <span className="border-l border-[#2A2F2A] pl-3">{userEmail}</span> : null}
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 border border-[#2A2F2A] px-3 py-2 text-[#E8EDE8] transition-colors hover:border-[#00E676] hover:text-[#00E676] focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#00E676]"
            >
              <LayoutDashboard size={15} aria-hidden="true" />
              Dashboard
            </a>
          </div>
        </header>

        <section className="mt-4 border border-[#2A2F2A] bg-[#10120F] p-4" aria-labelledby="new-lead-title">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={16} className="text-[#00E676]" aria-hidden="true" />
            <h2 id="new-lead-title" className="text-sm font-semibold text-white">Novo lead</h2>
          </div>
          <form className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_180px_auto]" onSubmit={createLead}>
            <label className="grid gap-1 text-xs text-[#AAB2AA]">
              Nome
              <input
                required
                disabled={submitDisabled}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="border border-[#2A2F2A] bg-[#0B0C0A] px-3 py-2 text-sm text-white outline-none placeholder:text-[#667066] focus:border-[#00E676]"
                placeholder="Nome do contato"
              />
            </label>
            <label className="grid gap-1 text-xs text-[#AAB2AA]">
              WhatsApp
              <input
                type="tel"
                disabled={submitDisabled}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="border border-[#2A2F2A] bg-[#0B0C0A] px-3 py-2 text-sm text-white outline-none placeholder:text-[#667066] focus:border-[#00E676]"
                placeholder="(11) 99999-9999"
              />
            </label>
            <label className="grid gap-1 text-xs text-[#AAB2AA]">
              Email
              <input
                type="email"
                disabled={submitDisabled}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="border border-[#2A2F2A] bg-[#0B0C0A] px-3 py-2 text-sm text-white outline-none placeholder:text-[#667066] focus:border-[#00E676]"
                placeholder="email@empresa.com"
              />
            </label>
            <label className="grid gap-1 text-xs text-[#AAB2AA]">
              Origem
              <select
                value={source}
                disabled={submitDisabled}
                onChange={(event) => setSource(event.target.value as LeadSource)}
                className="border border-[#2A2F2A] bg-[#0B0C0A] px-3 py-2 text-sm text-white outline-none focus:border-[#00E676]"
              >
                <option value="manual">Manual</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="landing_page">Landing page</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={submitDisabled}
              className="inline-flex items-center justify-center gap-2 border border-[#00E676] bg-[#00E676] px-4 py-2 text-sm font-semibold text-[#071109] transition-colors hover:bg-transparent hover:text-[#00E676] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {saving ? "Salvando..." : "Adicionar lead"}
            </button>
          </form>
        </section>

        <div className="mt-4 flex items-center justify-between border-b border-[#2A2F2A] pb-3">
          <h2 className="text-sm font-semibold text-white">Etapas</h2>
          <button
            type="button"
            onClick={() => void loadPipeline()}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-[#2A2F2A] px-3 py-2 text-xs text-[#E8EDE8] transition-colors hover:border-[#00E676] hover:text-[#00E676] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Atualizar
          </button>
        </div>

        {viewLabels.error ? (
          <p className="mt-4 flex items-center gap-2 border border-[#00E676] bg-[#10120F] p-3 text-sm text-[#E8EDE8]" role="alert">
            <AlertCircle size={16} className="text-[#00E676]" aria-hidden="true" />
            {viewLabels.error}
          </p>
        ) : null}

        {viewLabels.loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#AAB2AA]" role="status">
            <LoaderCircle size={16} className="animate-spin text-[#00E676]" aria-hidden="true" />
            {viewLabels.loading}
          </p>
        ) : null}

        {viewLabels.empty ? (
          <p className="mt-4 border border-[#2A2F2A] p-4 text-sm text-[#AAB2AA]">{viewLabels.empty}</p>
        ) : null}

        {!loading && columns.length > 0 ? (
          <section className="mt-4 grid gap-px overflow-x-auto border border-[#2A2F2A] bg-[#2A2F2A] lg:grid-cols-[repeat(var(--pipeline-columns),minmax(260px,1fr))]" style={{ "--pipeline-columns": columns.length } as React.CSSProperties} aria-label="Pipeline de leads">
            {columns.map(({ stage, leads: stageLeads }) => (
              <section key={stage.id} className="min-w-[260px] border-l-2 border-l-[#00E676] bg-[#10120F] p-3" aria-labelledby={`stage-${stage.id}`}>
                <header className="flex items-baseline justify-between gap-3 border-b border-[#2A2F2A] pb-3">
                  <h3 id={`stage-${stage.id}`} className="text-sm font-semibold text-white">{stage.name}</h3>
                  <span className="text-xs tabular-nums text-[#00E676]">{stageLeads.length} {stageLeads.length === 1 ? "lead" : "leads"}</span>
                </header>
                <div className="mt-3 grid gap-3">
                  {stageLeads.length === 0 ? <p className="py-3 text-xs text-[#667066]">Sem leads nesta etapa.</p> : null}
                  {stageLeads.map((lead) => (
                    <article key={lead.id} className="border border-[#2A2F2A] bg-[#0B0C0A] p-3">
                      <p className="text-sm font-semibold text-white">{lead.contact_name || "Contato sem nome"}</p>
                      <p className="mt-1 text-xs text-[#AAB2AA]">{sourceLabels[lead.source]}</p>
                      {lead.contact_phone ? <p className="mt-3 text-xs text-[#E8EDE8]">{lead.contact_phone}</p> : null}
                      {lead.contact_email ? <p className="mt-1 break-all text-xs text-[#AAB2AA]">{lead.contact_email}</p> : null}
                      <label className="mt-4 grid gap-1 text-xs text-[#AAB2AA]">
                        Mover para
                        <select
                          value={lead.stage_id}
                          aria-label={getMoveLeadAriaLabel(lead.contact_name, lead.id)}
                          disabled={movingLeadIds.has(lead.id)}
                          onChange={(event) => void moveLead(lead.id, event.target.value)}
                          className="border border-[#2A2F2A] bg-[#10120F] px-2 py-2 text-xs text-white outline-none focus:border-[#00E676] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {stages.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                        </select>
                      </label>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
