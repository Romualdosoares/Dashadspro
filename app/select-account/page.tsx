"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, Building2, User, CheckCircle2, ChevronRight, Loader2,
  AlertCircle, RefreshCw, LayoutDashboard, Layers, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MetaAdAccount, MetaBusiness } from "@/lib/types";

interface BusinessGroup {
  business: MetaBusiness;
  accounts: MetaAdAccount[];
}

interface AccountsData {
  personalAccounts: MetaAdAccount[];
  businessAccounts: BusinessGroup[];
}

interface SelectedEntry {
  account: MetaAdAccount;
  businessId?: string;
  businessName?: string;
}

function statusLabel(status: number) {
  const map: Record<number, { label: string; color: string }> = {
    1: { label: "Ativo", color: "text-[#39FF14] bg-[#39FF14]/10" },
    2: { label: "Desabilitado", color: "text-rose-400 bg-rose-500/10" },
    3: { label: "Não confirmado", color: "text-amber-400 bg-amber-500/10" },
    4: { label: "Pendente revisão", color: "text-amber-400 bg-amber-500/10" },
    5: { label: "Em revisão", color: "text-blue-400 bg-blue-500/10" },
    6: { label: "Pendente encerramento", color: "text-orange-400 bg-orange-500/10" },
    7: { label: "Cancelado", color: "text-gray-400 bg-gray-500/10" },
    8: { label: "Em revisão NHQ", color: "text-blue-400 bg-blue-500/10" },
    9: { label: "Encerrado", color: "text-gray-400 bg-gray-500/10" },
    100: { label: "Fechado", color: "text-gray-400 bg-gray-500/10" },
    101: { label: "Qualquer", color: "text-gray-400 bg-gray-500/10" },
    201: { label: "Anúncios pausados", color: "text-orange-400 bg-orange-500/10" },
  };
  return map[status] ?? { label: `Desconhecido (${status})`, color: "text-gray-400 bg-gray-500/10" };
}

function AccountCard({
  account,
  businessId,
  businessName,
  isChecked,
  onToggle,
  onSelectSingle,
  isSelecting,
  multiMode,
}: {
  account: MetaAdAccount;
  businessId?: string;
  businessName?: string;
  isChecked: boolean;
  onToggle: (entry: SelectedEntry) => void;
  onSelectSingle: (entry: SelectedEntry) => void;
  isSelecting: boolean;
  multiMode: boolean;
}) {
  const st = statusLabel(account.account_status);
  const isActive = account.account_status === 1;
  const entry: SelectedEntry = { account, businessId, businessName };

  return (
    <div
      className={`w-full flex items-center gap-4 border rounded-xl p-4 transition-all duration-200 group ${
        isActive
          ? isChecked
            ? "border-[#39FF14]/40 bg-[#39FF14]/5 cursor-pointer"
            : "border-[#1a1a1a] hover:border-[#39FF14]/25 hover:bg-white/[0.02] cursor-pointer"
          : "border-[#111] opacity-40 cursor-not-allowed"
      }`}
    >
      {/* Checkbox (modo multi) */}
      {multiMode && (
        <button
          onClick={() => isActive && onToggle(entry)}
          disabled={!isActive || isSelecting}
          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
            isChecked
              ? "bg-[#39FF14] border-[#39FF14]"
              : "border-[#333] hover:border-[#39FF14]/50"
          }`}
        >
          {isChecked && <CheckCircle2 size={12} className="text-black" />}
        </button>
      )}

      {/* Icon */}
      <div
        onClick={() => isActive && !multiMode && onSelectSingle(entry)}
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          isChecked ? "bg-[#39FF14]/20" : "bg-[#111] group-hover:bg-[#39FF14]/10"
        }`}
      >
        <span className={`font-bold text-xs font-mono ${isChecked ? "text-[#39FF14]" : "text-gray-500"}`}>
          {account.currency ?? "BRL"}
        </span>
      </div>

      {/* Info */}
      <div
        className="flex-1 min-w-0"
        onClick={() => isActive && (multiMode ? onToggle(entry) : onSelectSingle(entry))}
      >
        <p className="text-white text-sm font-medium truncate">{account.name}</p>
        <p className="text-gray-600 text-xs truncate mt-0.5 font-mono">{account.id}</p>
      </div>

      {/* Status + arrow */}
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${st.color}`}>
          {st.label}
        </span>
        {isActive && !multiMode && (
          <ChevronRight
            size={16}
            className="text-gray-700 group-hover:text-[#39FF14] transition-colors"
            onClick={() => onSelectSingle(entry)}
          />
        )}
      </div>
    </div>
  );
}

export default function SelectAccountPage() {
  const router = useRouter();
  const [data, setData] = useState<AccountsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [selected, setSelected] = useState<SelectedEntry[]>([]);

  const handleConnectFacebook = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: "email,public_profile,ads_read,ads_management,business_management",
        queryParams: { auth_type: "rerequest" },
      },
    });
  };

  const fetchAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta/businesses");
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Falha ao buscar contas");
      }
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível carregar as contas de anúncio.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const toggleEntry = (entry: SelectedEntry) => {
    setSelected((prev) => {
      const exists = prev.find((e) => e.account.id === entry.account.id);
      return exists ? prev.filter((e) => e.account.id !== entry.account.id) : [...prev, entry];
    });
  };

  const isChecked = (id: string) => selected.some((e) => e.account.id === id);

  // Seleciona uma conta como principal e vai ao dashboard
  const handleSelectSingle = async (entry: SelectedEntry) => {
    setIsSelecting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: entry.account.id,
          adAccountName: entry.account.name,
          businessId: entry.businessId,
          businessName: entry.businessName,
        }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Erro ao selecionar conta. Tente novamente.");
        setIsSelecting(false);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setIsSelecting(false);
    }
  };

  // Confirma seleção múltipla: define a 1ª como principal, salva IDs extras nos metadata
  const handleConfirmMulti = async () => {
    if (selected.length === 0) return;
    if (selected.length === 1) { handleSelectSingle(selected[0]); return; }
    setIsSelecting(true);
    setError(null);
    try {
      const primary = selected[0];
      const res = await fetch("/api/auth/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: primary.account.id,
          adAccountName: primary.account.name,
          businessId: primary.businessId,
          businessName: primary.businessName,
          extraAccountIds: selected.slice(1).map((e) => e.account.id),
          extraAccountNames: selected.slice(1).map((e) => e.account.name),
        }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Erro ao salvar contas. Tente novamente.");
        setIsSelecting(false);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setIsSelecting(false);
    }
  };

  const totalAccounts =
    (data?.personalAccounts.length ?? 0) +
    (data?.businessAccounts.reduce((s, g) => s + g.accounts.length, 0) ?? 0);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      {/* Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#39FF14]/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="p-2.5 bg-[#39FF14]/10 rounded-xl border border-[#39FF14]/20">
              <LayoutDashboard size={22} className="text-[#39FF14]" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              Dash<span className="text-[#39FF14]">Ads</span> Pro
            </span>
          </div>
          <h2 className="text-white font-semibold text-lg">Selecione a conta de anúncio</h2>
          <p className="text-gray-600 text-sm mt-1 font-mono">
            {isLoading
              ? "Buscando contas vinculadas..."
              : error
              ? "Erro ao carregar"
              : `${totalAccounts} conta${totalAccounts !== 1 ? "s" : ""} encontrada${totalAccounts !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 size={32} className="text-[#39FF14] animate-spin" />
            <p className="text-gray-600 text-sm font-mono">Conectando ao Facebook Business Manager...</p>
          </div>
        )}

        {/* Erro */}
        {error && !isLoading && (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 text-center">
            <AlertCircle size={32} className="text-rose-400 mx-auto mb-3" />
            <p className="text-rose-400 text-sm mb-4">{error}</p>
            <button onClick={fetchAccounts}
              className="flex items-center gap-2 mx-auto bg-[#111] hover:bg-[#1a1a1a] text-white text-sm px-4 py-2 rounded-xl transition-colors cursor-pointer">
              <RefreshCw size={14} /> Tentar novamente
            </button>
          </div>
        )}

        {/* Contas */}
        {data && !isLoading && (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 space-y-5 shadow-2xl shadow-black/60">

            {/* Modo multi / normal toggle */}
            {totalAccounts > 1 && (
              <div className="flex items-center justify-between pb-3 border-b border-[#111]">
                <div className="flex items-center gap-2">
                  <Layers size={13} className="text-gray-600" />
                  <span className="text-gray-500 text-xs">
                    {multiMode ? `${selected.length} conta${selected.length !== 1 ? "s" : ""} selecionada${selected.length !== 1 ? "s" : ""}` : "Clique em uma conta para entrar"}
                  </span>
                </div>
                <button
                  onClick={() => { setMultiMode((v) => !v); setSelected([]); }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                    multiMode
                      ? "bg-[#39FF14]/15 text-[#39FF14] border-[#39FF14]/30"
                      : "text-gray-500 border-[#1a1a1a] hover:text-[#39FF14] hover:border-[#39FF14]/20"
                  }`}
                >
                  {multiMode ? "Modo único" : "Multi-conta"}
                </button>
              </div>
            )}

            {isSelecting && (
              <div className="flex items-center gap-3 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-xl px-4 py-3">
                <Loader2 size={16} className="text-[#39FF14] animate-spin" />
                <p className="text-[#39FF14] text-sm font-mono">Conectando ao dashboard...</p>
              </div>
            )}

            {error && !isSelecting && data && (
              <div className="flex items-center gap-3 bg-rose-950/50 border border-rose-500/30 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <p className="text-rose-400 text-sm">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-rose-600 hover:text-rose-400 cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Contas Pessoais */}
            {data.personalAccounts.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <User size={13} className="text-gray-600" />
                  <h3 className="text-gray-600 text-xs uppercase tracking-wider font-semibold">Contas Pessoais</h3>
                </div>
                <div className="space-y-2">
                  {data.personalAccounts.map((acc) => (
                    <AccountCard key={acc.id} account={acc}
                      isChecked={isChecked(acc.id)}
                      onToggle={toggleEntry}
                      onSelectSingle={handleSelectSingle}
                      isSelecting={isSelecting}
                      multiMode={multiMode}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Business Managers */}
            {data.businessAccounts.map(({ business, accounts }) =>
              accounts.length > 0 ? (
                <section key={business.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={13} className="text-gray-600" />
                    <h3 className="text-gray-600 text-xs uppercase tracking-wider font-semibold truncate">{business.name}</h3>
                  </div>
                  <div className="space-y-2">
                    {accounts.map((acc) => (
                      <AccountCard key={acc.id} account={acc}
                        businessId={business.id} businessName={business.name}
                        isChecked={isChecked(acc.id)}
                        onToggle={toggleEntry}
                        onSelectSingle={handleSelectSingle}
                        isSelecting={isSelecting}
                        multiMode={multiMode}
                      />
                    ))}
                  </div>
                </section>
              ) : null
            )}

            {/* Nenhuma conta */}
            {totalAccounts === 0 && (
              <div className="text-center py-8">
                <CheckCircle2 size={32} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhuma conta de anúncio encontrada.</p>
                <p className="text-gray-700 text-xs mt-1">Verifique o Facebook Business Manager.</p>
              </div>
            )}

            {/* Botão confirmar multi */}
            {multiMode && selected.length > 0 && (
              <button
                onClick={handleConfirmMulti}
                disabled={isSelecting}
                className="w-full flex items-center justify-center gap-2 bg-[#39FF14] hover:bg-[#2bcc10] text-black font-bold text-sm py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSelecting ? <Loader2 size={16} className="animate-spin" /> : <LayoutDashboard size={16} />}
                Abrir dashboard com {selected.length} conta{selected.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}

        {/* Conectar Facebook */}
        <div className="mt-5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5">
          <p className="text-gray-600 text-xs mb-3 text-center">
            Não encontrou suas contas? Conecte sua conta do Facebook.
          </p>
          <button
            onClick={handleConnectFacebook}
            className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#1565D8] text-white font-semibold rounded-xl py-3 text-sm transition-all duration-200 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Conectar com o Facebook
          </button>
        </div>

        <p className="text-center text-gray-700 text-xs mt-4">
          <button
            onClick={() => fetch("/api/auth/logout", { method: "POST" }).then(() => { window.location.href = "/login"; })}
            className="hover:text-gray-500 transition-colors cursor-pointer"
          >
            Sair e entrar com outra conta
          </button>
        </p>
      </div>
    </div>
  );
}
