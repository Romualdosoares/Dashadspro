"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") ?? "";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam ? "Ocorreu um erro. Tente novamente." : null
  );

  useEffect(() => {
    if (errorParam) setError("Ocorreu um erro. Tente novamente.");
  }, [errorParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push(redirect);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Credenciais inválidas");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="p-2.5 bg-[#39FF14] rounded-xl shadow-lg shadow-[#39FF14]/20">
              <LayoutDashboard size={22} className="text-black" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              Dash<span className="text-[#39FF14]" style={{ textShadow: "0 0 12px rgba(57,255,20,0.4)" }}>Ads</span> Pro
            </span>
          </div>
          <p className="text-gray-600 text-sm font-mono">Gestão de tráfego pago em tempo real</p>
        </div>

        {/* Card */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 shadow-2xl shadow-black/60">
          <h1 className="text-lg font-semibold text-white mb-6">Entrar na plataforma</h1>

          {error && (
            <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 mb-5">
              <AlertCircle size={15} className="text-rose-400 mt-0.5 shrink-0" />
              <p className="text-rose-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 block font-semibold">
                E-mail
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exemplo.com"
                  required
                  className="w-full bg-[#111] border border-[#1a1a1a] text-white placeholder-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#39FF14]/40 focus:ring-1 focus:ring-[#39FF14]/10 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
                  Senha
                </label>
                <Link href="/reset-password" className="text-[11px] text-gray-600 hover:text-[#39FF14] transition-colors">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#111] border border-[#1a1a1a] text-white placeholder-gray-700 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-[#39FF14]/40 focus:ring-1 focus:ring-[#39FF14]/10 transition-all font-mono"
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

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-[#39FF14] hover:bg-[#2bcc10] disabled:bg-[#111] disabled:text-gray-700 text-black font-bold rounded-xl py-3 text-sm transition-all duration-200 mt-2 cursor-pointer shadow-lg shadow-[#39FF14]/10"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : "Entrar"}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-6">
            Não tem conta?{" "}
            <Link href="/register" className="text-[#39FF14] hover:underline font-medium">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
