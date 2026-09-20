"use client";

import dynamic from "next/dynamic";

interface AccountInfo {
  adAccountId: string | null;
  adAccountName: string;
  userName: string;
  businessName: string;
  role: "admin" | "user";
  extraAccountIds?: string[];
  extraAccountNames?: string[];
}

const DashAdsPro = dynamic(() => import("@/DashAdsPro"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#39FF14]/20 border-t-[#39FF14] rounded-full animate-spin" />
        <p className="text-gray-600 text-sm font-mono">Carregando dashboard...</p>
      </div>
    </div>
  ),
});

export default function DashboardClient({ accountInfo }: { accountInfo: AccountInfo }) {
  return <DashAdsPro accountInfo={accountInfo} />;
}
