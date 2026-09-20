"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, User } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error ?? "Erro ao criar conta. Tente novamente.");
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

        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 shadow-2xl shadow-black/60">
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-[#39FF14]" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-2">Conta criada!</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enviamos um e-mail de confirmação para <span className="text-white font-mono">{email}</span>. Confirme antes de entrar.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center bg-[#39FF14] hover:bg-[#2bcc10] text-black font-bold rounded-xl px-6 py-2.5 text-sm transition-all"
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-white mb-6">Criar conta</h1>

              {error && (
                <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertCircle size={15} className="text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-rose-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 block font-semibold">
                    Nome
                  </label>
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      required
                      className="w-full bg-[#111] border border-[#1a1a1a] text-white placeholder-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#39FF14]/40 focus:ring-1 focus:ring-[#39FF14]/10 transition-all"
                    />
                  </div>
                </div>

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
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 block font-semibold">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
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

                <div>
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 block font-semibold">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-[#111] border border-[#1a1a1a] text-white placeholder-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#39FF14]/40 focus:ring-1 focus:ring-[#39FF14]/10 transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email || !password || !name}
                  className="w-full bg-[#39FF14] hover:bg-[#2bcc10] disabled:bg-[#111] disabled:text-gray-700 text-black font-bold rounded-xl py-3 text-sm transition-all duration-200 mt-2 cursor-pointer shadow-lg shadow-[#39FF14]/10"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      Criando conta...
                    </span>
                  ) : "Criar conta"}
                </button>
              </form>

              <p className="text-center text-gray-600 text-xs mt-6">
                Já tem conta?{" "}
                <Link href="/login" className="text-[#39FF14] hover:underline font-medium">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
