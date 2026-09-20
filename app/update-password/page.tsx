"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  );
}

function UpdatePasswordForm() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase inserts session from recovery token in the URL hash automatically
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    // Also check if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/dashboard"), 2000);
      }
    } catch {
      setError("Erro ao atualizar senha. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#39FF14]/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="p-2.5 bg-[#39FF14] rounded-xl shadow-lg shadow-[#39FF14]/20">
              <LayoutDashboard size={22} className="text-black" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              Dash<span className="text-[#39FF14]" style={{ textShadow: "0 0 12px rgba(57,255,20,0.4)" }}>Ads</span> Pro
            </span>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 shadow-2xl shadow-black/60">
          <h1 className="text-lg font-semibold text-white mb-2">Nova senha</h1>
          <p className="text-gray-600 text-sm mb-6">Defina sua nova senha de acesso.</p>

          {success ? (
            <div className="flex items-start gap-3 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-xl px-4 py-3">
              <CheckCircle2 size={15} className="text-[#39FF14] mt-0.5 shrink-0" />
              <p className="text-[#39FF14] text-sm">Senha atualizada! Redirecionando...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle size={15} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-rose-400 text-sm">{error}</p>
                </div>
              )}

              {!sessionReady && (
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle size={15} className="text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-amber-400 text-sm">Aguardando verificação do link de recuperação...</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 block font-semibold">
                    Nova senha
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                      disabled={!sessionReady}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-white placeholder-gray-700 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-[#39FF14]/40 focus:ring-1 focus:ring-[#39FF14]/10 transition-all font-mono disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 block font-semibold">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repita a nova senha"
                      required
                      disabled={!sessionReady}
                      className="w-full bg-[#111] border border-[#1a1a1a] text-white placeholder-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#39FF14]/40 focus:ring-1 focus:ring-[#39FF14]/10 transition-all font-mono disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !sessionReady || !password || !confirm}
                  className="w-full bg-[#39FF14] hover:bg-[#2bcc10] disabled:bg-[#111] disabled:text-gray-700 text-black font-bold rounded-xl py-3 text-sm transition-all duration-200 mt-2 cursor-pointer shadow-lg shadow-[#39FF14]/10"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      Atualizando...
                    </span>
                  ) : "Atualizar senha"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
