"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LoaderCircle, PanelsTopLeft, RefreshCw, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type NavigationItem = {
  key: string;
  href: string;
  label: string;
  icon: string;
};

const iconMap = {
  BarChart3,
  UsersRound,
  PanelsTopLeft,
} as const;

function hasKnownIcon(icon: string): icon is keyof typeof iconMap {
  return Object.prototype.hasOwnProperty.call(iconMap, icon);
}

export default function ClientFeatureNavigation({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await fetch("/api/features/context");
      if (!response.ok) throw new Error("Feature context unavailable");
      const body = await response.json();
      setItems(Array.isArray(body.features) ? body.features.filter((item: unknown): item is NavigationItem => {
        if (typeof item !== "object" || item === null) return false;
        const value = item as Record<string, unknown>;
        return typeof value.key === "string"
          && typeof value.href === "string"
          && typeof value.label === "string"
          && typeof value.icon === "string"
          && hasKnownIcon(value.icon);
      }) : []);
    } catch {
      setItems([]);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={`flex min-h-11 items-center gap-2 text-xs text-[#7C847C] ${className}`} role="status" aria-label="Carregando navegação dos produtos">
        <LoaderCircle size={14} className="animate-spin text-[#39FF14]" aria-hidden="true" />
        <span className="sr-only">Carregando produtos...</span>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className={`flex min-h-11 items-center ${className}`}>
        <button
          type="button"
          onClick={() => void load()}
          title="Tentar carregar a navegação novamente"
          aria-label="Tentar carregar a navegação dos produtos novamente"
          className="inline-flex size-11 items-center justify-center border border-[#2B302B] text-[#7C847C] transition-colors hover:border-[#39FF14] hover:text-[#39FF14] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14]"
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (items.length === 0) return <div className={`min-h-11 ${className}`} aria-hidden="true" />;

  return (
    <nav aria-label="Produtos disponíveis" className={`max-w-full ${className}`}>
      <div className="flex min-h-11 max-w-full items-center gap-1 overflow-x-auto">
        {items.map((item) => {
          if (!hasKnownIcon(item.icon)) return null;
          const Icon = iconMap[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 border px-3 text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14] ${
                active
                  ? "border-[#39FF14] bg-[#39FF14]/10 text-[#39FF14]"
                  : "border-[#2B302B] text-[#A5ADA5] hover:border-[#39FF14]/60 hover:text-white"
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
