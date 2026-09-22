import { redirect } from "next/navigation";
import FeatureAccessDenied from "@/components/FeatureAccessDenied";
import { requireOrganizationFeature } from "@/lib/feature-access";

export default async function SitesPage() {
  const access = await requireOrganizationFeature("site_builder");
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return <FeatureAccessDenied error={access.error} />;
  }

  return (
    <main className="min-h-screen bg-[#050505] p-6 text-white sm:p-10">
      <section className="mx-auto max-w-2xl border border-[#2B302B] bg-[#0A0A0A] p-6">
        <p className="font-mono text-xs text-[#39FF14]">CRIADOR DE SITES</p>
        <h1 className="mt-3 text-2xl font-semibold">Criador de sites em preparação</h1>
        <p className="mt-3 text-sm text-[#A5ADA5]">
          Esta área será disponibilizada em breve.
        </p>
      </section>
    </main>
  );
}
