/**
 * DashAds Pro — WhatsApp Report Generator + Z-API Sender
 */

import { fetchAdAccountInsights, fetchCampaignInsights } from "./meta-api";
import { normalizeBrazilianPhone } from "./report-schedule";

// ── Formatters ──────────────────────────────────────────────────────────────
function fmtCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtInt(val: number): string {
  return Math.round(val).toLocaleString("pt-BR");
}
function fmtPct(val: number): string {
  return val.toFixed(2) + "%";
}

// ── Report text builder ─────────────────────────────────────────────────────
export interface ReportData {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  reach: number;
  purchases: number;
  purchaseValue: number;
  roas: number | null;
  cpa: number | null;
  topCampaigns: Array<{ name: string; spend: number; roas: number | null }>;
  dateLabel: string;
  accountName?: string;
}

export function buildWhatsAppMessage(data: ReportData): string {
  const roasEmoji = data.roas === null ? "❔" : data.roas >= 3 ? "🟢" : data.roas >= 1 ? "🟡" : "🔴";
  const ctrEmoji = data.ctr >= 3 ? "🟢" : data.ctr >= 1 ? "🟡" : "🔴";
  const roasStr = data.roas !== null ? `${data.roas.toFixed(2)}x ${roasEmoji}` : "N/A";
  const cpaStr = data.cpa !== null ? fmtCurrency(data.cpa) : "N/A";

  const header = `📊 *DashAds Pro — Relatório*`;
  const date = `📅 ${data.dateLabel}`;
  const accountLine = data.accountName ? `🏢 ${data.accountName}` : "";

  const main = [
    `💰 *Principais*`,
    `• Investimento: ${fmtCurrency(data.spend)}`,
    `• Receita: ${fmtCurrency(data.purchaseValue)}`,
    `• ROAS: ${roasStr}`,
    `• Compras: ${fmtInt(data.purchases)}`,
    `• CPA: ${cpaStr}`,
  ].join("\n");

  const perf = [
    `📈 *Performance*`,
    `• CTR: ${fmtPct(data.ctr)} ${ctrEmoji}`,
    `• CPM: ${fmtCurrency(data.cpm)}`,
    `• Cliques: ${fmtInt(data.clicks)}`,
    `• Impressões: ${fmtInt(data.impressions)}`,
    `• Alcance: ${fmtInt(data.reach)}`,
  ].join("\n");

  let campaigns = "";
  if (data.topCampaigns.length > 0) {
    const lines = data.topCampaigns.slice(0, 3).map((c, i) => {
      const emoji = ["🥇", "🥈", "🥉"][i] ?? "•";
      const roas = c.roas !== null ? ` | ROAS ${c.roas.toFixed(2)}x` : "";
      const name = c.name.length > 28 ? c.name.slice(0, 25) + "..." : c.name;
      return `${emoji} ${name} — ${fmtCurrency(c.spend)}${roas}`;
    });
    campaigns = `\n🏆 *Top Campanhas*\n${lines.join("\n")}`;
  }

  const footer = `\n🤖 _DashAds Pro • dashboardpremium.vercel.app_`;

  return [header, date, accountLine, "", main, "", perf, campaigns, footer]
    .filter((l) => l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Fetch insights for report ────────────────────────────────────────────────
export async function fetchReportData(
  adAccountId: string,
  token: string,
  datePreset: string,
  accountName?: string
): Promise<ReportData> {
  const [overview, campaigns] = await Promise.all([
    fetchAdAccountInsights(adAccountId, token, datePreset),
    fetchCampaignInsights(adAccountId, token, datePreset),
  ]);

  const spend = parseFloat(overview?.spend ?? "0");
  const impressions = parseInt(overview?.impressions ?? "0", 10);
  const clicks = parseInt(overview?.clicks ?? "0", 10);
  const ctr = parseFloat(overview?.ctr ?? "0");
  const cpm = parseFloat(overview?.cpm ?? "0");
  const reach = parseInt(overview?.reach ?? "0", 10);

  const purchaseAction = overview?.actions?.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );
  const purchaseValueAction = overview?.action_values?.find(
    (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
  );
  const purchases = parseFloat(purchaseAction?.value ?? "0");
  const purchaseValue = parseFloat(purchaseValueAction?.value ?? "0");
  const roas = purchaseValue > 0 && spend > 0 ? purchaseValue / spend : null;
  const cpa = purchases > 0 && spend > 0 ? spend / purchases : null;

  const topCampaigns = campaigns
    .map((c) => {
      const cv = c.action_values?.find(
        (a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase"
      );
      const cs = parseFloat(c.spend ?? "0");
      const croas = cv && cs > 0 ? parseFloat(cv.value) / cs : null;
      return { name: c.name, spend: cs, roas: croas };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3);

  const dateLabels: Record<string, string> = {
    today: "Hoje",
    yesterday: "Ontem",
    last_3d: "Últimos 3 dias",
    last_7d: "Últimos 7 dias",
    last_30d: "Últimos 30 dias",
    this_month: "Este mês",
    last_month: "Mês passado",
  };
  const today = new Date().toLocaleDateString("pt-BR");
  const dateLabel = `${dateLabels[datePreset] ?? datePreset} • ${today}`;

  return {
    spend, impressions, clicks, ctr, cpm, reach,
    purchases, purchaseValue, roas, cpa,
    topCampaigns, dateLabel, accountName,
  };
}

// ── Z-API sender ─────────────────────────────────────────────────────────────
export async function sendZapiMessage(
  phone: string,
  zapiInstance: string,
  zapiToken: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const normalized = normalizeBrazilianPhone(phone);

    const url = `https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone: normalized, message }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Erro de rede" };
  }
}
