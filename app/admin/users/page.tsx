"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Trash2, Edit2, Key, Check, X, Search,
  AlertCircle, Loader2, RefreshCw,
  Eye, EyeOff, Mail, User, Crown,
} from "lucide-react";
import AdminShell from "../AdminShell";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  provider: string;
  confirmed: boolean;
  created_at: string;
  last_sign_in: string | null;
}

type ModalType = "create" | "edit" | "password" | "delete" | null;

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalType>(null);
  const [target, setTarget] = useState<AdminUser | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "user">("user");
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao carregar");
      const { users } = await res.json();
      setUsers(users);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setFormName(""); setFormEmail(""); setFormPassword(""); setFormRole("user");
    setFormError(null); setFormSuccess(null); setShowPass(false);
    setTarget(null); setModal("create");
  };

  const openEdit = (u: AdminUser) => {
    setFormName(u.name); setFormEmail(u.email); setFormRole(u.role);
    setFormError(null); setFormSuccess(null);
    setTarget(u); setModal("edit");
  };

  const openPassword = (u: AdminUser) => {
    setFormPassword(""); setShowPass(false);
    setFormError(null); setFormSuccess(null);
    setTarget(u); setModal("password");
  };

  const openDelete = (u: AdminUser) => {
    setFormError(null); setTarget(u); setModal("delete");
  };

  const closeModal = () => { setModal(null); setTarget(null); setFormError(null); setFormSuccess(null); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPassword || formPassword.length < 6) {
      setFormError("Senha deve ter pelo menos 6 caracteres."); return;
    }
    setSaving(true); setFormError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, email: formEmail, password: formPassword, role: formRole }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      setFormSuccess("Usuário criado com sucesso!");
      await load();
      setTimeout(closeModal, 1200);
    } catch { setFormError("Erro de conexão."); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch(`/api/admin/users/${target!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, role: formRole }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      setFormSuccess("Alterações salvas!");
      await load();
      setTimeout(closeModal, 1000);
    } catch { setFormError("Erro de conexão."); }
    finally { setSaving(false); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPassword.length < 6) { setFormError("Senha deve ter pelo menos 6 caracteres."); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await fetch(`/api/admin/users/${target!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: formPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      setFormSuccess("Senha alterada com sucesso!");
      setTimeout(closeModal, 1000);
    } catch { setFormError("Erro de conexão."); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true); setFormError(null);
    try {
      const res = await fetch(`/api/admin/users/${target!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error); return; }
      await load();
      closeModal();
    } catch { setFormError("Erro de conexão."); }
    finally { setSaving(false); }
  };

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const admins = users.filter((u) => u.role === "admin").length;

  return (
    <AdminShell title="Usuários" description="Contas, funções e acesso administrativo.">
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total de Usuários", value: users.length, icon: Users, color: "text-white" },
            { label: "Admins", value: admins, icon: Crown, color: "text-[#39FF14]" },
            { label: "Usuários", value: users.length - admins, icon: User, color: "text-gray-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 flex items-center gap-3">
              <div className="p-2 bg-[#111] border border-[#1a1a1a] rounded-lg">
                <Icon size={16} className={color} />
              </div>
              <div>
                <p className={`text-xl font-black font-mono leading-none ${color}`}>{value}</p>
                <p className="text-gray-600 text-[10px] mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[#111]">
            <div className="flex items-center gap-2 flex-1">
              <Users size={14} className="text-gray-600 shrink-0" />
              <span className="text-white font-semibold text-sm">Usuários</span>
              <span className="text-gray-600 text-xs font-mono ml-1">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar usuário..."
                  aria-label="Buscar usuário"
                  className="min-h-11 bg-[#111] border border-[#1a1a1a] text-white placeholder-gray-700 rounded-xl pl-8 pr-4 py-2 text-xs focus:outline-none focus:border-[#39FF14]/40 w-40 sm:w-56 transition-all font-mono"
                />
              </div>
              <button onClick={load} title="Atualizar usuários" aria-label="Atualizar usuários" className="size-11 grid place-items-center rounded-xl bg-[#111] border border-[#1a1a1a] text-gray-500 hover:text-[#39FF14] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] transition-all cursor-pointer">
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
              <button onClick={openCreate}
                className="min-h-11 flex items-center gap-1.5 text-xs font-semibold bg-[#39FF14] hover:bg-[#2bcc10] text-black px-3 py-2 rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <UserPlus size={13} /> Novo usuário
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 mx-4 sm:mx-6 my-4 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="text-rose-400 shrink-0" />
              <p className="text-rose-400 text-sm">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 size={20} className="text-[#39FF14] animate-spin" />
              <span className="text-gray-600 text-sm font-mono">Carregando usuários...</span>
            </div>
          )}

          {/* Table */}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-[#111]">
                    {["Usuário", "E-mail", "Função", "Provedor", "Confirmado", "Último acesso", "Ações"].map((h) => (
                      <th key={h} className="text-left text-gray-600 text-[10px] uppercase tracking-wider px-4 sm:px-6 py-3 font-semibold first:pl-4 sm:first:pl-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-b border-[#0d0d0d] hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#39FF14]/20 to-[#1a8a0a]/20 border border-[#39FF14]/15 flex items-center justify-center shrink-0">
                            <span className="text-[#39FF14] font-bold text-[10px]">
                              {(u.name || u.email)[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-white font-medium text-sm truncate max-w-[140px]">{u.name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className="text-gray-400 text-xs font-mono truncate max-w-[180px] block">{u.email}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        {u.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20">
                            <Crown size={9} /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-500/10 text-gray-400 border border-gray-500/20">
                            <User size={9} /> Usuário
                          </span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className="text-gray-500 text-xs font-mono capitalize">{u.provider}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        {u.confirmed
                          ? <span className="text-[#39FF14]"><Check size={14} /></span>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className="text-gray-600 text-xs font-mono">{fmt(u.last_sign_in)}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(u)} title="Editar"
                            className="size-11 grid place-items-center rounded-lg text-gray-600 hover:text-[#39FF14] hover:bg-[#39FF14]/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] transition-all cursor-pointer">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => openPassword(u)} title="Alterar senha"
                            className="size-11 grid place-items-center rounded-lg text-gray-600 hover:text-amber-400 hover:bg-amber-500/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] transition-all cursor-pointer">
                            <Key size={13} />
                          </button>
                          <button onClick={() => openDelete(u)} title="Excluir"
                            className="size-11 grid place-items-center rounded-lg text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] transition-all cursor-pointer">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-700 text-sm font-mono">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Gerenciar usuário"
            className="relative w-full sm:max-w-md bg-[#0a0a0a] border border-[#1a1a1a] rounded-t-3xl sm:rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#111]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#111] rounded-xl border border-[#1a1a1a]">
                  {modal === "create" && <UserPlus size={15} className="text-[#39FF14]" />}
                  {modal === "edit" && <Edit2 size={15} className="text-[#39FF14]" />}
                  {modal === "password" && <Key size={15} className="text-amber-400" />}
                  {modal === "delete" && <Trash2 size={15} className="text-rose-400" />}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">
                    {modal === "create" && "Novo Usuário"}
                    {modal === "edit" && "Editar Usuário"}
                    {modal === "password" && "Alterar Senha"}
                    {modal === "delete" && "Excluir Usuário"}
                  </p>
                  {target && <p className="text-gray-600 text-xs font-mono mt-0.5 truncate max-w-[260px]">{target.email}</p>}
                </div>
              </div>
              <button onClick={closeModal} title="Fechar" aria-label="Fechar" className="size-11 grid place-items-center text-gray-600 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-5">
              {/* Feedback */}
              {formError && (
                <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5 mb-4">
                  <AlertCircle size={13} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-rose-400 text-xs">{formError}</p>
                </div>
              )}
              {formSuccess && (
                <div className="flex items-start gap-2 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-xl px-3 py-2.5 mb-4">
                  <Check size={13} className="text-[#39FF14] mt-0.5 shrink-0" />
                  <p className="text-[#39FF14] text-xs">{formSuccess}</p>
                </div>
              )}

              {/* Create form */}
              {modal === "create" && (
                <form onSubmit={handleCreate} className="space-y-4">
                  <Field label="Nome" icon={User}>
                    <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" required
                      className="input-admin" />
                  </Field>
                  <Field label="E-mail" icon={Mail}>
                    <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" required
                      className="input-admin font-mono" />
                  </Field>
                  <Field label="Senha" icon={Key}>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres" required className="input-admin font-mono pr-9" />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        title={showPass ? "Ocultar senha" : "Mostrar senha"}
                        aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-0 top-1/2 size-11 -translate-y-1/2 grid place-items-center text-gray-600 hover:text-gray-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] cursor-pointer">
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Função" icon={Crown}>
                    <RoleSelect value={formRole} onChange={setFormRole} />
                  </Field>
                  <ModalActions saving={saving} onCancel={closeModal} label="Criar usuário" />
                </form>
              )}

              {/* Edit form */}
              {modal === "edit" && (
                <form onSubmit={handleEdit} className="space-y-4">
                  <Field label="Nome" icon={User}>
                    <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" required
                      className="input-admin" />
                  </Field>
                  <Field label="E-mail" icon={Mail}>
                    <input value={formEmail} disabled className="input-admin font-mono opacity-50 cursor-not-allowed" />
                  </Field>
                  <Field label="Função" icon={Crown}>
                    <RoleSelect value={formRole} onChange={setFormRole} />
                  </Field>
                  <ModalActions saving={saving} onCancel={closeModal} label="Salvar alterações" />
                </form>
              )}

              {/* Password form */}
              {modal === "password" && (
                <form onSubmit={handlePassword} className="space-y-4">
                  <p className="text-gray-500 text-xs mb-2">
                    Defina uma nova senha para <span className="text-white font-mono">{target?.email}</span>
                  </p>
                  <Field label="Nova senha" icon={Key}>
                    <div className="relative">
                      <input type={showPass ? "text" : "password"} value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres" required className="input-admin font-mono pr-9" />
                      <button type="button" onClick={() => setShowPass(!showPass)}
                        title={showPass ? "Ocultar senha" : "Mostrar senha"}
                        aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                        className="absolute right-0 top-1/2 size-11 -translate-y-1/2 grid place-items-center text-gray-600 hover:text-gray-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] cursor-pointer">
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </Field>
                  <ModalActions saving={saving} onCancel={closeModal} label="Alterar senha" color="amber" />
                </form>
              )}

              {/* Delete confirm */}
              {modal === "delete" && (
                <div>
                  <p className="text-gray-400 text-sm mb-1">
                    Tem certeza que deseja excluir o usuário:
                  </p>
                  <p className="text-white font-semibold mb-1">{target?.name || "—"}</p>
                  <p className="text-gray-500 text-xs font-mono mb-5">{target?.email}</p>
                  <p className="text-rose-400 text-xs mb-5">Esta ação é irreversível e removerá todos os dados do usuário.</p>
                  <div className="flex gap-3">
                    <button onClick={closeModal} className="flex-1 py-2.5 rounded-xl bg-[#111] border border-[#1a1a1a] text-gray-400 text-sm hover:bg-[#1a1a1a] transition-colors cursor-pointer">
                      Cancelar
                    </button>
                    <button onClick={handleDelete} disabled={saving}
                      className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Excluir
                    </button>
                  </div>
                  {formError && <p className="text-rose-400 text-xs mt-3 text-center">{formError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline styles for admin inputs */}
      <style jsx global>{`
        .input-admin {
          width: 100%;
          min-height: 44px;
          background: #111;
          border: 1px solid #1a1a1a;
          color: white;
          border-radius: 0.75rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.8125rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-admin::placeholder { color: #374151; }
        .input-admin:focus { border-color: rgba(57,255,20,0.4); }
      `}</style>
    </AdminShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] text-gray-600 uppercase tracking-wider mb-1.5 font-semibold">
        <Icon size={10} /> {label}
      </label>
      {children}
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: "admin" | "user"; onChange: (v: "admin" | "user") => void }) {
  return (
    <div className="flex gap-2">
      {(["user", "admin"] as const).map((r) => (
        <button key={r} type="button" onClick={() => onChange(r)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            value === r
              ? r === "admin"
                ? "bg-[#39FF14]/15 border-[#39FF14]/30 text-[#39FF14]"
                : "bg-gray-500/15 border-gray-500/30 text-gray-300"
              : "bg-[#111] border-[#1a1a1a] text-gray-600 hover:border-[#333]"
          }`}>
          {r === "admin" ? <Crown size={12} /> : <User size={12} />}
          {r === "admin" ? "Admin" : "Usuário"}
        </button>
      ))}
    </div>
  );
}

function ModalActions({ saving, onCancel, label, color = "green" }: {
  saving: boolean; onCancel: () => void; label: string; color?: "green" | "amber";
}) {
  const btnClass = color === "amber"
    ? "bg-amber-500 hover:bg-amber-600 text-black"
    : "bg-[#39FF14] hover:bg-[#2bcc10] text-black";
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onCancel}
        className="flex-1 py-2.5 rounded-xl bg-[#111] border border-[#1a1a1a] text-gray-400 text-sm hover:bg-[#1a1a1a] transition-colors cursor-pointer">
        Cancelar
      </button>
      <button type="submit" disabled={saving}
        className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${btnClass}`}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
        {saving ? "Salvando..." : label}
      </button>
    </div>
  );
}
