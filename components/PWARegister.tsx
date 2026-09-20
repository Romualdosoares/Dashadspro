"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Registra o service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }

    // Captura o evento de instalação do PWA
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Mostra o banner somente se não foi dispensado antes
      const dismissed = sessionStorage.getItem("pwa-banner-dismissed");
      if (!dismissed) setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-6 md:max-w-sm animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#0a0a0a] border border-[#39FF14]/20 rounded-2xl p-4 shadow-2xl shadow-black/80 flex items-center gap-4">
        <div className="w-10 h-10 bg-[#39FF14]/10 border border-[#39FF14]/20 rounded-xl flex items-center justify-center shrink-0">
          <Download size={18} className="text-[#39FF14]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">Instalar DashAds Pro</p>
          <p className="text-gray-600 text-xs mt-0.5">Acesso rápido direto da tela inicial</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstall}
            className="bg-[#39FF14] hover:bg-[#2bcc10] text-black text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
