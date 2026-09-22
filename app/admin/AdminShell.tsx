"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  Cable,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelsTopLeft,
  Settings2,
  Users,
  UsersRound,
} from "lucide-react";

const primaryLinks = [
  { href: "/admin/features", label: "Features", icon: Settings2 },
  { href: "/admin/clients", label: "Clientes", icon: UsersRound },
  { href: "/admin/users", label: "Usuários", icon: Users },
] as const;

const productLinks = [
  { id: "landing-page", href: "/admin/products?section=landing-page#landing-page", label: "Landing Page", icon: FileText },
  { id: "dashboard-ads", href: "/admin/products?section=dashboard-ads#dashboard-ads", label: "Dashboard Ads", icon: Megaphone },
  { id: "crm", href: "/admin/products?section=crm#crm", label: "CRM", icon: UsersRound },
  { id: "site-builder", href: "/admin/products?section=site-builder#site-builder", label: "Criador de Sites", icon: PanelsTopLeft },
  { id: "payment-gateways", href: "/admin/products?section=payment-gateways#payment-gateways", label: "Gateways de pagamento", icon: CreditCard },
  { id: "apis", href: "/admin/products?section=apis#apis", label: "APIs", icon: Cable },
] as const;

function navClass(active: boolean) {
  return `relative flex min-h-11 items-center gap-3 border border-transparent px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:border-[#39FF14] ${
    active
      ? "bg-[#10120F] text-white before:absolute before:-left-px before:inset-y-1 before:w-[3px] before:bg-[#39FF14]"
      : "text-[#8B938B] hover:border-[#262B26] hover:text-white"
  }`;
}

export default function AdminShell({
  title,
  description,
  activeProduct,
  children,
}: {
  title: string;
  description: string;
  activeProduct?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] font-mono text-[#E8EDE8]">
      <header className="sticky top-0 z-40 border-b border-[#1A1E1A] bg-[#050505]/95">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/admin/products" className="flex min-h-11 items-center gap-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14]">
            <span className="grid size-8 place-items-center border border-[#39FF14]/40 bg-[#39FF14]/10 text-[#39FF14]">
              <Boxes size={16} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">Administração</span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-[#626A62]">DashAds Pro</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-2 border border-[#242824] px-3 text-xs text-[#A9B0A9] transition-colors hover:border-[#39FF14] hover:text-[#39FF14] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14]"
            >
              <LayoutDashboard size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex min-h-11 items-center gap-2 border border-[#242824] px-3 text-xs text-[#A9B0A9] transition-colors hover:border-rose-500 hover:text-rose-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14]"
            >
              <LogOut size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-[#1A1E1A] bg-[#090A09] lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <nav aria-label="Administração" className="border-l-[3px] border-[#39FF14] p-3 lg:sticky lg:top-16 lg:p-4">
            <div className="grid grid-cols-3 gap-1 lg:grid-cols-1">
              {primaryLinks.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={navClass(pathname === href)}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>

            <div className="mt-4 border-t border-[#202420] pt-4">
              <h2 className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6F776F]">Produtos e ajustes</h2>
              <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {productLinks.map(({ id, href, label, icon: Icon }, index) => {
                  const active = pathname === "/admin/products" && (activeProduct === id || (!activeProduct && index === 0));
                  return (
                    <Link key={href} href={href} aria-current={active ? "location" : undefined} className={navClass(active)}>
                      <Icon size={15} aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 border-b border-[#202420] pb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#8B938B]">{description}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
