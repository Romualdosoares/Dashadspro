import Link from "next/link";
import { Cable, CreditCard, ExternalLink, FileText, Megaphone, PanelsTopLeft, UsersRound } from "lucide-react";
import AdminShell from "../AdminShell";

type ProductStatus = {
  id: string;
  name: string;
  description: string;
  status: "Disponível" | "Configurado" | "Configuração parcial" | "Não configurado";
  detail: string;
  href?: string;
  icon: typeof FileText;
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const reportsConfigured = Boolean(process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY);

  const products: ProductStatus[] = [
    {
      id: "landing-page",
      name: "Landing Page",
      description: "Página pública de entrada do DashAds Pro.",
      status: "Disponível",
      detail: "Rota pública existente em /.",
      href: "/",
      icon: FileText,
    },
    {
      id: "dashboard-ads",
      name: "Dashboard Ads",
      description: "Leitura e operação de campanhas conectadas à Meta.",
      status: "Disponível",
      detail: "Interface e endpoints Meta existentes. A conexão é feita por conta.",
      href: "/dashboard",
      icon: Megaphone,
    },
    {
      id: "crm",
      name: "CRM",
      description: "Pipeline de leads por organização.",
      status: "Disponível",
      detail: "Interface, contexto e endpoints de leads existentes.",
      href: "/crm",
      icon: UsersRound,
    },
    {
      id: "site-builder",
      name: "Criador de Sites",
      description: "Criação e publicação de páginas para campanhas.",
      status: "Não configurado",
      detail: "Nenhuma rota de produto está integrada neste projeto.",
      icon: PanelsTopLeft,
    },
    {
      id: "payment-gateways",
      name: "Gateways de pagamento",
      description: "Integrações de cobrança e processamento de pagamentos.",
      status: "Não configurado",
      detail: "Nenhum gateway de pagamento está integrado neste projeto.",
      icon: CreditCard,
    },
    {
      id: "apis",
      name: "APIs",
      description: "Conexões de dados usadas pelos produtos.",
      status: supabaseConfigured && reportsConfigured
        ? "Configurado"
        : supabaseConfigured || reportsConfigured
          ? "Configuração parcial"
          : "Não configurado",
      detail: `Supabase: ${supabaseConfigured ? "configurado" : "não configurado"}. Criptografia de relatórios: ${reportsConfigured ? "configurada" : "não configurada"}.`,
      icon: Cable,
    },
  ];

  return (
    <AdminShell
      title="Produtos e ajustes"
      description="Estado técnico das áreas disponíveis. Esta tela não altera configurações."
      activeProduct={section}
    >
      <div className="grid gap-3 xl:grid-cols-2">
        {products.map(({ id, name, description, status, detail, href, icon: Icon }) => (
          <section
            id={id}
            key={id}
            className="scroll-mt-24 border border-[#242824] bg-[#0A0B0A] p-4 target:border-[#39FF14]"
            aria-labelledby={`${id}-title`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center border border-[#2B302B] text-[#39FF14]">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 id={`${id}-title`} className="text-sm font-semibold text-white">{name}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#8B938B]">{description}</p>
                </div>
              </div>
              <span className={`shrink-0 border px-2 py-1 text-[10px] uppercase tracking-wide ${
                status === "Disponível" || status === "Configurado"
                  ? "border-[#39FF14]/50 text-[#39FF14]"
                  : "border-[#404640] text-[#A5ADA5]"
              }`}>
                {status}
              </span>
            </div>
            <p className="mt-4 border-l-2 border-[#303630] pl-3 text-xs leading-5 text-[#A5ADA5]">{detail}</p>
            {href ? (
              <Link
                href={href}
                className="mt-4 inline-flex min-h-11 items-center gap-2 border border-[#2B302B] px-3 text-xs text-white hover:border-[#39FF14] hover:text-[#39FF14] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#39FF14]"
              >
                Abrir produto
                <ExternalLink size={14} aria-hidden="true" />
              </Link>
            ) : null}
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
