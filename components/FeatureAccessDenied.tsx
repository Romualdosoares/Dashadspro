import ClientFeatureNavigation from "@/components/ClientFeatureNavigation";

export default function FeatureAccessDenied({ error }: { error: string }) {
  return (
    <main className="min-h-screen bg-[#050505] p-6 text-white sm:p-10">
      <section className="mx-auto max-w-2xl border border-[#2B302B] bg-[#0A0A0A] p-6">
        <p className="font-mono text-xs text-[#39FF14]">ACESSO RESTRITO</p>
        <h1 className="mt-3 text-2xl font-semibold">Este painel não está disponível</h1>
        <p className="mt-3 text-sm text-[#A5ADA5]">{error}</p>
        <div className="mt-6 border-t border-[#2B302B] pt-5">
          <p className="text-sm text-[#A5ADA5]">Abra um painel disponível:</p>
          <ClientFeatureNavigation className="mt-3" />
        </div>
      </section>
    </main>
  );
}
