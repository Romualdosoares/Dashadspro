"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/useRealtime";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  DollarSign, Target, TrendingUp, TrendingDown, BarChart3, Eye, MousePointerClick,
  ChevronDown, Calendar, Layers, ArrowDown, ArrowUp, Activity, Zap, Monitor, Video,
  Table2, CheckCircle2, Bell, Settings, LayoutDashboard, LogOut,
  ChevronDown as ChevronDownIcon, RefreshCw, AlertCircle, Loader2,
  Download, Users, MapPin, ShoppingCart, FileText, Image,
  MessageCircle, Megaphone, UserPlus, Play, Store, Globe, Columns3, X, GripVertical,
  Link2, Copy, Trash2, Plus, ExternalLink, Check, Briefcase,
  HeartPulse, ChevronRight, Info, AlertTriangle, XCircle, Shield,
  Pause, PlayCircle, Archive, MoreVertical, Pencil, Ban,
  ToggleLeft, ToggleRight, Sliders, BellRing, ChevronUp,
  Star, Trophy, TrendingUp as TrendingUpIcon, FileDown, GitCompare,
  MoreHorizontal,
} from "lucide-react";

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface AccountInfo {
  adAccountId: string | null;
  adAccountName: string;
  userName: string;
  businessName?: string;
  role?: "admin" | "user";
  extraAccountIds?: string[];
  extraAccountNames?: string[];
}

interface InsightsOverview {
  spend: string; impressions: string; clicks: string; ctr: string;
  cpm: string; reach: string; frequency: string; purchases: string; purchaseValue: string;
  roas: number | null;
}

interface Comparison {
  spend: number | null; impressions: number | null; clicks: number | null;
  ctr: number | null; cpm: number | null; purchases: number | null;
  roas: number | null; cpc: number | null;
}

interface DailyInsight { date: string; impressions: number; clicks: number; spend: number; }
interface PlatformBreakdown { platform: string; percent: number; spend: string; }
interface VideoRetention { p25: number; p50: number; p75: number; p100: number; }

interface Funnel {
  impressions: number; clicks: number; landing_page_view: number;
  view_content: number; add_to_cart: number; initiate_checkout: number;
  purchase: number; lead: number;
}

interface InsightsData {
  overview: InsightsOverview; comparison: Comparison; daily: DailyInsight[];
  platformBreakdown: PlatformBreakdown[]; videoRetention: VideoRetention | null;
  funnel: Funnel;
}

interface CampaignRow {
  id: string; name: string; status: string; objective: string; buying_type: string;
  spend: string; impressions: string; clicks: string; ctr: string; cpc: string;
  cpm: string; cpp: string; reach: string; frequency: string;
  actions: Array<{ action_type: string; value: string }>;
  action_values: Array<{ action_type: string; value: string }>;
}

interface AdRow {
  id: string; name: string; adset_name: string; campaign_id: string; campaign_name: string;
  spend: string; impressions: string; clicks: string; ctr: string;
  cpc: string; cpm: string; reach: string;
  actions: Array<{ action_type: string; value: string }>;
}

interface DemoRow {
  age?: string; gender?: string; region?: string;
  spend: string; impressions: string; clicks: string; ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
}

interface CreativeRow {
  id: string; name: string; thumbnail_url: string; spend: string;
  impressions: string; clicks: string; ctr: string; cpc: string;
  actions: Array<{ action_type: string; value: string }>;
}

interface AdsetRow {
  id: string; name: string; campaign_id: string; campaign_name: string;
  status: string; optimization_goal: string; billing_event: string;
  spend: string; impressions: string; clicks: string; ctr: string;
  cpc: string; cpm: string; reach: string; frequency: string;
  daily_budget: string | null; lifetime_budget: string | null; budget_remaining: string | null;
  actions: Array<{ action_type: string; value: string }>;
  action_values: Array<{ action_type: string; value: string }>;
}

// ─── Automação / Regras ──────────────────────────────────────────────────────
type RuleMetric = "roas" | "ctr" | "cpm" | "cpc" | "spend" | "frequency";
type RuleOperator = "lt" | "gt";
type RuleAction = "pause" | "notify";

interface AutoRule {
  id: string;
  name: string;
  metric: RuleMetric;
  operator: RuleOperator;
  threshold: number;
  action: RuleAction;
  enabled: boolean;
  lastTriggered: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "Últimos 3 dias", value: "last_3d" },
  { label: "Últimos 7 dias", value: "last_7d" },
  { label: "Últimos 30 dias", value: "last_30d" },
  { label: "Este mês", value: "this_month" },
  { label: "Mês passado", value: "last_month" },
  { label: "Período personalizado", value: "custom" },
];

function fmt(n: string | number, d = 2): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtCurrency(n: string | number): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "R$ 0,00";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtInt(n: string | number): string {
  const num = typeof n === "string" ? parseInt(String(n), 10) : Math.round(n);
  if (isNaN(num)) return "0";
  return num.toLocaleString("pt-BR");
}

function fmtDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function getPurchases(actions: Array<{ action_type: string; value: string }>): number {
  const a = actions?.find(
    (x) => x.action_type === "offsite_conversion.fb_pixel_purchase" || x.action_type === "purchase"
  );
  return parseInt(a?.value ?? "0", 10);
}

function getPurchaseValue(actionValues: Array<{ action_type: string; value: string }>): number {
  const a = actionValues?.find(
    (x) => x.action_type === "offsite_conversion.fb_pixel_purchase" || x.action_type === "purchase"
  );
  return parseFloat(a?.value ?? "0");
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#39FF14", instagram: "#22cc66", audience_network: "#1a8a0a", messenger: "#15ff60",
};

// ─── Objective Map ──────────────────────────────────────────────────────────

const OBJECTIVE_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  OUTCOME_SALES: { label: "Vendas", icon: ShoppingCart, color: "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/20" },
  OUTCOME_LEADS: { label: "Leads", icon: UserPlus, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  OUTCOME_ENGAGEMENT: { label: "Engajamento", icon: Activity, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  OUTCOME_AWARENESS: { label: "Reconhecimento", icon: Eye, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  OUTCOME_TRAFFIC: { label: "Tráfego", icon: Globe, color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
  OUTCOME_APP_PROMOTION: { label: "App", icon: Play, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  CONVERSIONS: { label: "Conversões", icon: Target, color: "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/20" },
  LINK_CLICKS: { label: "Tráfego", icon: Globe, color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
  MESSAGES: { label: "Mensagens", icon: MessageCircle, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  REACH: { label: "Alcance", icon: Megaphone, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  BRAND_AWARENESS: { label: "Marca", icon: Eye, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  POST_ENGAGEMENT: { label: "Engajamento", icon: Activity, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  VIDEO_VIEWS: { label: "Visualizações", icon: Video, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  LEAD_GENERATION: { label: "Leads", icon: UserPlus, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  PRODUCT_CATALOG_SALES: { label: "Catálogo", icon: Store, color: "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/20" },
  STORE_VISITS: { label: "Visitas Loja", icon: Store, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
};

// ─── Health Score Engine ─────────────────────────────────────────────────────

/**
 * Benchmarks baseados nas médias de mercado da Meta Ads (Brasil, 2024):
 * Fonte: Meta Ads Benchmark Reports + WordStream Industry Averages
 *
 * 4 níveis de saúde:
 *  excellent — acima do benchmark ideal (destaque positivo)
 *  good      — dentro da faixa saudável
 *  warning   — atenção, abaixo do ideal mas não crítico
 *  critical  — fora dos parâmetros, precisa de ação imediata
 */

type HealthStatus = "excellent" | "good" | "warning" | "critical";

interface KpiCheck {
  key: string;
  label: string;
  value: string;
  status: HealthStatus;
  benchmark: string;   // ex: "Meta saudável: CTR > 1,5%"
  tip: string;
  weight: number; // 1-3, peso no score final
}

interface HealthReport {
  score: number;       // 0-100
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  status: HealthStatus;
  checks: KpiCheck[];
  primaryIssue: string | null;
}

// 4-level status helper — excellent / good / warning / critical
function kpi4(value: number, excellent: number, good: number, warn: number, inverted = false): HealthStatus {
  if (!inverted) {
    if (value >= excellent) return "excellent";
    if (value >= good)      return "good";
    if (value >= warn)      return "warning";
    return "critical";
  } else {
    if (value <= excellent) return "excellent";
    if (value <= good)      return "good";
    if (value <= warn)      return "warning";
    return "critical";
  }
}

function calcHealthScore(r: CampaignRow): HealthReport {
  const obj = r.objective;
  const spend = parseFloat(r.spend ?? "0");
  const ctr = parseFloat(r.ctr ?? "0");
  const cpm = parseFloat(r.cpm ?? "0");
  const cpc = parseFloat(r.cpc ?? "0");
  const frequency = parseFloat(r.frequency ?? "0");
  const impressions = parseInt(r.impressions ?? "0", 10);
  const clicks = parseInt(r.clicks ?? "0", 10);

  const getAction = (types: string[]) =>
    r.actions?.find((a) => types.includes(a.action_type));
  const getActionVal = (types: string[]) =>
    parseInt(getAction(types)?.value ?? "0", 10);
  const getActionValueSum = (types: string[]) =>
    r.action_values?.filter((a) => types.includes(a.action_type))
      .reduce((s, a) => s + parseFloat(a.value), 0) ?? 0;

  const messages = getActionVal([
    "onsite_conversion.messaging_conversation_started_7d",
    "onsite_conversion.total_messaging_connection",
  ]);
  const leads = getActionVal(["lead", "offsite_conversion.fb_pixel_lead"]);
  const purchases = getActionVal(["offsite_conversion.fb_pixel_purchase", "purchase"]);
  const purchaseValue = getActionValueSum(["offsite_conversion.fb_pixel_purchase", "purchase"]);
  const videoViews = getActionVal(["video_view"]);
  const pageViews = getActionVal(["landing_page_view"]);
  const addToCart = getActionVal(["offsite_conversion.fb_pixel_add_to_cart", "add_to_cart"]);

  const roas = spend > 0 && purchaseValue > 0 ? purchaseValue / spend : 0;
  const cpl = leads > 0 && spend > 0 ? spend / leads : 0;
  const cpMessage = messages > 0 && spend > 0 ? spend / messages : 0;
  const convRate = clicks > 0 && purchases > 0 ? (purchases / clicks) * 100 : 0;
  const landingRate = clicks > 0 && pageViews > 0 ? (pageViews / clicks) * 100 : 0;
  const cartRate = pageViews > 0 && addToCart > 0 ? (addToCart / pageViews) * 100 : 0;

  const checks: KpiCheck[] = [];

  // ── CTR (universal) ──────────────────────────────────────────────────────
  // Excellent >3%, Good 1.5-3%, Warning 0.5-1.5%, Critical <0.5%
  if (impressions > 0) {
    const s = kpi4(ctr, 3, 1.5, 0.5);
    checks.push({
      key: "ctr", label: "CTR", value: `${fmt(ctr, 2)}%`, status: s, weight: 2,
      benchmark: "Benchmark Meta BR: Excelente >3% · Saudável 1,5–3% · Atenção 0,5–1,5% · Crítico <0,5%",
      tip: s === "excellent"
        ? "CTR excepcional (>3%) — criativo altamente relevante para o público. Continue testando variações para manter o desempenho."
        : s === "good"
        ? "CTR saudável (1,5–3%) — o criativo está atraindo cliques adequados. Para ir ao próximo nível, teste headlines mais diretos e imagens com contraste maior."
        : s === "warning"
        ? "CTR abaixo do ideal (0,5–1,5%). O criativo está pouco atrativo. Teste novas imagens, vídeos curtos e CTAs mais claros como 'Saiba mais' ou 'Ver oferta'."
        : "CTR crítico (<0,5%). O criativo não está gerando interesse. Revise urgentemente: público errado, imagem muito genérica ou copy sem proposta de valor clara.",
    });
  }

  // ── Frequência ───────────────────────────────────────────────────────────
  // Excellent 1.0-1.8, Good 1.8-2.5, Warning 2.5-3.5, Critical >3.5
  if (frequency > 0) {
    const freqStatus: HealthStatus =
      frequency <= 1.8 ? "excellent" :
      frequency <= 2.5 ? "good" :
      frequency <= 3.5 ? "warning" : "critical";
    checks.push({
      key: "frequency", label: "Frequência", value: fmt(frequency, 1), status: freqStatus, weight: 2,
      benchmark: "Benchmark Meta BR: Excelente 1,0–1,8x · Saudável 1,8–2,5x · Atenção 2,5–3,5x · Saturado >3,5x",
      tip: freqStatus === "excellent"
        ? "Frequência ideal (≤1,8x) — cada pessoa está vendo o anúncio poucas vezes, sem saturação. Maximize o alcance com orçamento adicional."
        : freqStatus === "good"
        ? "Frequência saudável (1,8–2,5x) — dentro da faixa recomendada. Monitore semanalmente para evitar queda no CTR por saturação."
        : freqStatus === "warning"
        ? "Frequência elevada (2,5–3,5x). O público já está vendo o anúncio com frequência. Atualize os criativos ou expanda o público para baixar a frequência."
        : "Público saturado (>3,5x). O CPM sobe e o CTR cai. Ação necessária: pause o conjunto, renove todos os criativos ou amplie drasticamente o público-alvo.",
    });
  }

  // ── CPM ──────────────────────────────────────────────────────────────────
  // Excellent <15, Good 15-30, Warning 30-60, Critical >60
  if (impressions > 0) {
    const s: HealthStatus = cpm <= 15 ? "excellent" : cpm <= 30 ? "good" : cpm <= 60 ? "warning" : "critical";
    checks.push({
      key: "cpm", label: "CPM", value: fmtCurrency(cpm), status: s, weight: 1,
      benchmark: "Benchmark Meta BR: Excelente <R$15 · Saudável R$15–30 · Atenção R$30–60 · Crítico >R$60",
      tip: s === "excellent"
        ? "CPM excelente (<R$15) — custo de alcance muito baixo. Escale o orçamento enquanto o CPM estiver nesse nível."
        : s === "good"
        ? "CPM eficiente (R$15–30) — custo de alcance dentro do esperado para o mercado brasileiro."
        : s === "warning"
        ? "CPM moderado (R$30–60). Possíveis causas: público muito segmentado, alta concorrência no período ou baixo relevance score. Teste públicos mais amplos ou lookalike."
        : "CPM alto (>R$60). O leilão está caro. Reduza a segmentação, evite sobreposição de públicos e revise os posicionamentos — remova Instagram Stories se pouco performático.",
    });
  }

  // ── Checks por objetivo ───────────────────────────────────────────────────

  const isSales = ["OUTCOME_SALES", "CONVERSIONS", "PRODUCT_CATALOG_SALES"].includes(obj);
  const isLeads = ["OUTCOME_LEADS", "LEAD_GENERATION"].includes(obj);
  const isMessages = obj === "MESSAGES";
  const isTraffic = ["OUTCOME_TRAFFIC", "LINK_CLICKS"].includes(obj);
  const isAwareness = ["OUTCOME_AWARENESS", "REACH", "BRAND_AWARENESS"].includes(obj);
  const isEngagement = ["OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT"].includes(obj);
  const isVideo = obj === "VIDEO_VIEWS";

  if (isSales) {
    // ROAS: Excellent >5x, Good 3-5x, Warning 1-3x, Critical <1x
    if (spend > 0) {
      const s: HealthStatus = roas >= 5 ? "excellent" : roas >= 3 ? "good" : roas >= 1 ? "warning" : "critical";
      checks.push({
        key: "roas", label: "ROAS", value: roas > 0 ? `${fmt(roas, 2)}x` : "—", status: roas > 0 ? s : "critical", weight: 3,
        benchmark: "Benchmark Meta BR: Excelente >5x · Saudável 3–5x · Atenção 1–3x · Crítico <1x (prejuízo)",
        tip: roas === 0
          ? "Nenhuma compra rastreada pelo pixel. Verifique se o evento 'Purchase' está instalado na página de confirmação de pedido."
          : s === "excellent"
          ? `ROAS excepcional (${fmt(roas,2)}x)! Para cada R$1 investido, retorna R$${fmt(roas,2)} em vendas. Escale o orçamento progressivamente (+20%/semana).`
          : s === "good"
          ? `ROAS saudável (${fmt(roas,2)}x). Campanha rentável. Para superar 5x, otimize o checkout, ofereça frete grátis ou adicione prova social ao anúncio.`
          : s === "warning"
          ? `ROAS abaixo de 3x (atual: ${fmt(roas,2)}x). Revise a oferta, melhore a página de produto e teste públicos de remarketing que convertem melhor.`
          : `ROAS negativo (${fmt(roas,2)}x) — a campanha está no prejuízo. Pause imediatamente e analise: preço do produto, custo do frete e qualidade do público.`,
      });
    }
    // Taxa de conversão: Excellent >3%, Good 2-3%, Warning 0.5-2%, Critical <0.5%
    if (clicks > 0) {
      const s: HealthStatus = convRate >= 3 ? "excellent" : convRate >= 2 ? "good" : convRate >= 0.5 ? "warning" : "critical";
      checks.push({
        key: "conv_rate", label: "Taxa de Conversão", value: convRate > 0 ? `${fmt(convRate, 2)}%` : "—", status: convRate > 0 ? s : "critical", weight: 3,
        benchmark: "Benchmark e-commerce BR: Excelente >3% · Saudável 2–3% · Atenção 0,5–2% · Crítico <0,5%",
        tip: convRate === 0
          ? "Nenhuma conversão detectada. Confirme que o pixel de 'Purchase' está disparando corretamente na página de obrigado."
          : s === "excellent"
          ? `Taxa de conversão excelente (${fmt(convRate,2)}%)! Acima da média do e-commerce brasileiro (1–2%). Invista em upsell e cross-sell para aumentar o ticket.`
          : s === "good"
          ? `Taxa saudável (${fmt(convRate,2)}%). Está dentro da média. Para aumentar, teste elementos de urgência (contador de estoque, timer) e depoimentos de clientes.`
          : s === "warning"
          ? `Taxa baixa (${fmt(convRate,2)}%). A página de destino precisa melhorar: carregamento rápido (meta <3s), CTA visível acima da dobra e formulário simplificado.`
          : `Taxa crítica (${fmt(convRate,2)}%). Problema sério na landing page ou no público (muito frio). Teste uma página diferente com VSL ou revise a oferta principal.`,
      });
    }
    // Add ao Carrinho: Excellent >8%, Good 5-8%, Warning 2-5%, Critical <2%
    if (pageViews > 0 && addToCart > 0) {
      const s: HealthStatus = cartRate >= 8 ? "excellent" : cartRate >= 5 ? "good" : cartRate >= 2 ? "warning" : "critical";
      checks.push({
        key: "cart_rate", label: "Add ao Carrinho", value: `${fmt(cartRate, 1)}%`, status: s, weight: 2,
        benchmark: "Benchmark e-commerce BR: Excelente >8% · Saudável 5–8% · Atenção 2–5% · Crítico <2%",
        tip: s === "excellent"
          ? `Taxa de carrinho excelente (${fmt(cartRate,1)}%)! O produto está despertando forte interesse. Foque em recuperar carrinhos abandonados com remarketing.`
          : s === "good"
          ? `Taxa de carrinho saudável (${fmt(cartRate,1)}%). Para aumentar, melhore as fotos do produto, adicione variações de cores/tamanhos e destaque o frete grátis.`
          : s === "warning"
          ? `Taxa baixa (${fmt(cartRate,1)}%). O produto não está convencendo. Teste preços diferentes, adicione avaliações visíveis e melhore a galeria de imagens.`
          : `Taxa crítica (${fmt(cartRate,1)}%). O público pode não reconhecer o produto ou o preço está acima do que espera pagar. Teste promoções com desconto explícito.`,
      });
    }
    // CPC: Excellent <1.50, Good 1.50-2.50, Warning 2.50-5, Critical >5
    if (clicks > 0) {
      const s: HealthStatus = cpc <= 1.5 ? "excellent" : cpc <= 2.5 ? "good" : cpc <= 5 ? "warning" : "critical";
      checks.push({
        key: "cpc", label: "CPC", value: fmtCurrency(cpc), status: s, weight: 1,
        benchmark: "Benchmark Meta BR (vendas): Excelente <R$1,50 · Saudável R$1,50–2,50 · Atenção R$2,50–5 · Crítico >R$5",
        tip: s === "excellent"
          ? `CPC excelente (<R$1,50) — tráfego muito barato. Aproveite para escalar o orçamento.`
          : s === "good"
          ? `CPC dentro do esperado (R$1,50–2,50). Para reduzir, melhore o CTR com criativos mais chamativos.`
          : s === "warning"
          ? `CPC elevado (R$${fmt(cpc,2)}). Criativo pouco relevante ou público saturado. Teste variações de copy e imagem.`
          : `CPC crítico (>R$5). Leilão caro ou relevance score muito baixo. Renove todos os criativos e revise a segmentação.`,
      });
    }
  }

  if (isLeads) {
    // CPL: Excellent <15, Good 15-30, Warning 30-80, Critical >80
    if (leads > 0) {
      const s: HealthStatus = cpl <= 15 ? "excellent" : cpl <= 30 ? "good" : cpl <= 80 ? "warning" : "critical";
      checks.push({
        key: "cpl", label: "Custo por Lead", value: fmtCurrency(cpl), status: s, weight: 3,
        benchmark: "Benchmark Meta BR (leads): Excelente <R$15 · Saudável R$15–30 · Atenção R$30–80 · Crítico >R$80",
        tip: s === "excellent"
          ? `CPL excepcional (<R$15)! Custo muito baixo por lead. Escale o orçamento e qualifique os leads com perguntas adicionais no formulário.`
          : s === "good"
          ? `CPL saudável (R$${fmt(cpl,2)}). Para reduzir ainda mais, simplifique o formulário para no máximo 4 campos e use Lead Ads nativos do Facebook.`
          : s === "warning"
          ? `CPL elevado (R$${fmt(cpl,2)}). Revise a isca digital oferecida, simplifique o formulário e teste públicos lookalike de clientes atuais.`
          : `CPL crítico (>R$80). Formulário com muitos campos, público frio ou isca pouco atrativa. Teste um e-book, desconto exclusivo ou webinar como recompensa.`,
      });
    } else if (spend > 0) {
      checks.push({ key: "cpl", label: "Custo por Lead", value: "—", status: "critical", weight: 3,
        benchmark: "Benchmark Meta BR: Lead saudável custa entre R$15–30",
        tip: "Nenhum lead rastreado. Verifique se o evento de 'Lead' está configurado no pixel ou no Lead Ads do Facebook." });
    }
    // Landing rate: Excellent >85%, Good 70-85%, Warning 40-70%, Critical <40%
    if (clicks > 0 && pageViews > 0) {
      const s: HealthStatus = landingRate >= 85 ? "excellent" : landingRate >= 70 ? "good" : landingRate >= 40 ? "warning" : "critical";
      checks.push({
        key: "landing_rate", label: "Taxa de Chegada", value: `${fmt(landingRate, 0)}%`, status: s, weight: 2,
        benchmark: "Benchmark: Excelente >85% · Saudável 70–85% · Atenção 40–70% · Crítico <40%",
        tip: s === "excellent"
          ? `Excelente taxa de chegada (${fmt(landingRate,0)}%) — quase todos os cliques chegam à página. Página rápida e sem redirecionamentos desnecessários.`
          : s === "good"
          ? `Taxa de chegada saudável (${fmt(landingRate,0)}%). Para melhorar, verifique se a URL de destino carrega em menos de 3 segundos no mobile.`
          : s === "warning"
          ? `Taxa baixa (${fmt(landingRate,0)}%). Muitos cliques não chegam à página. Teste PageSpeed Insights e remova scripts pesados. Meta: <3s no mobile.`
          : `Taxa crítica (${fmt(landingRate,0)}%). Página muito lenta, redirecionamento quebrado ou incompatível com dispositivos iOS. Use AMP ou uma landing page otimizada.`,
      });
    }
  }

  if (isMessages) {
    // Custo por conversa: Excellent <3, Good 3-8, Warning 8-15, Critical >15
    if (messages > 0) {
      const s: HealthStatus = cpMessage <= 3 ? "excellent" : cpMessage <= 8 ? "good" : cpMessage <= 15 ? "warning" : "critical";
      checks.push({
        key: "cp_message", label: "Custo por Conversa", value: fmtCurrency(cpMessage), status: s, weight: 3,
        benchmark: "Benchmark Meta BR (mensagens): Excelente <R$3 · Saudável R$3–8 · Atenção R$8–15 · Crítico >R$15",
        tip: s === "excellent"
          ? `Custo por conversa excelente (<R$3)! Escale o orçamento e garanta que a equipe de atendimento responde em menos de 5 minutos para maximizar conversões.`
          : s === "good"
          ? `Custo por conversa saudável (R$${fmt(cpMessage,2)}). Para reduzir, use criativos com o botão 'Enviar mensagem' muito visível e copy com urgência ('Responda agora').`
          : s === "warning"
          ? `Custo por conversa elevado (R$${fmt(cpMessage,2)}). Teste públicos mais segmentados (interesses específicos do nicho) e criativos com oferta de resposta rápida.`
          : `Custo alto por conversa (>R$15). Revise o público, o criativo e verifique se o CTA de mensagem está visível. Considere usar o objetivo 'Conversas' no nível do conjunto.`,
      });
    } else if (spend > 0) {
      checks.push({ key: "cp_message", label: "Conversas Iniciadas", value: "0", status: "critical", weight: 3,
        benchmark: "Benchmark Meta BR: Conversa saudável custa entre R$3–8",
        tip: "Nenhuma conversa rastreada. Verifique se o objetivo do conjunto está como 'Mensagens' e se o pixel de conversa está ativo na página do WhatsApp ou Messenger." });
    }
    // Taxa de conversa por mil impressões: Excellent >8, Good 5-8, Warning 2-5, Critical <2
    if (impressions > 0 && messages > 0) {
      const msgRate = (messages / impressions) * 1000;
      const s: HealthStatus = msgRate >= 8 ? "excellent" : msgRate >= 5 ? "good" : msgRate >= 2 ? "warning" : "critical";
      checks.push({
        key: "msg_rate", label: "Conversas / 1000 imp.", value: fmt(msgRate, 1), status: s, weight: 2,
        benchmark: "Benchmark: Excelente >8 · Saudável 5–8 · Atenção 2–5 · Crítico <2 conversas por 1.000 impressões",
        tip: s === "excellent"
          ? `Taxa excepcional (${fmt(msgRate,1)} conversas/1000 imp.). Criativo altamente eficaz para o público. Salve este criativo como referência e teste variações.`
          : s === "good"
          ? `Taxa saudável (${fmt(msgRate,1)}/1000 imp.). Para aumentar, adicione um gatilho de urgência no copy: 'Vagas limitadas' ou 'Atendimento hoje até as 20h'.`
          : s === "warning"
          ? `Taxa baixa (${fmt(msgRate,1)}/1000 imp.). O público está vendo mas não iniciando conversa. Use depoimentos em vídeo e CTA mais direto: 'Clique e fale agora'.`
          : `Taxa muito baixa (${fmt(msgRate,1)}/1000 imp.). Público não está engajando com o criativo. Revise completamente: troque o formato, use vídeo curto e oferta clara.`,
      });
    }
  }

  if (isTraffic) {
    // CPC tráfego: Excellent <0.80, Good 0.80-1.50, Warning 1.50-3, Critical >3
    if (clicks > 0) {
      const s: HealthStatus = cpc <= 0.8 ? "excellent" : cpc <= 1.5 ? "good" : cpc <= 3 ? "warning" : "critical";
      checks.push({
        key: "cpc_traffic", label: "CPC", value: fmtCurrency(cpc), status: s, weight: 3,
        benchmark: "Benchmark Meta BR (tráfego): Excelente <R$0,80 · Saudável R$0,80–1,50 · Atenção R$1,50–3 · Crítico >R$3",
        tip: s === "excellent"
          ? `CPC excepcional (<R$0,80) para tráfego! Escale o orçamento enquanto o custo estiver baixo. Retargete esses visitantes com campanhas de conversão.`
          : s === "good"
          ? `CPC eficiente (R$${fmt(cpc,2)}) para campanha de tráfego. Para reduzir, teste títulos com perguntas ou números: '5 motivos para...' tende a ter CTR maior.`
          : s === "warning"
          ? `CPC elevado (R$${fmt(cpc,2)}). Tráfego caro. Melhore o CTR com criativos mais apelativos e revise os posicionamentos — Feed tende a ser mais barato que Stories.`
          : `CPC crítico (>R$3) para tráfego. Muito acima da média. Revise urgentemente: segmentação muito estreita, leilão saturado ou criativo com baixa relevância.`,
      });
    }
    // Landing rate: Excellent >85%, Good 70-85%, Warning 40-70%, Critical <40%
    if (clicks > 0 && pageViews > 0) {
      const s: HealthStatus = landingRate >= 85 ? "excellent" : landingRate >= 70 ? "good" : landingRate >= 40 ? "warning" : "critical";
      checks.push({
        key: "landing_rate", label: "Taxa de Chegada", value: `${fmt(landingRate, 0)}%`, status: s, weight: 2,
        benchmark: "Benchmark: Excelente >85% · Saudável 70–85% · Atenção 40–70% · Crítico <40%",
        tip: s === "excellent"
          ? `Excelente taxa de chegada (${fmt(landingRate,0)}%). Página rápida e bem otimizada — usuários chegam sem abandono.`
          : s === "good"
          ? `Taxa boa (${fmt(landingRate,0)}%). Para chegar a 85%+, comprima imagens da landing page e use CDN para assets pesados.`
          : s === "warning"
          ? `Taxa baixa (${fmt(landingRate,0)}%). Muitos usuários desistem antes de chegar. Teste a velocidade no PageSpeed Insights (meta: >90 pontos no mobile).`
          : `Taxa crítica (${fmt(landingRate,0)}%). Página incompatível, lenta ou com erro. Verifique o link de destino e o comportamento no mobile agora.`,
      });
    }
  }

  if (isAwareness) {
    // CPM awareness: Excellent <10, Good 10-20, Warning 20-50, Critical >50
    const s: HealthStatus = cpm <= 10 ? "excellent" : cpm <= 20 ? "good" : cpm <= 50 ? "warning" : "critical";
    checks.push({
      key: "cpm_awareness", label: "CPM (Alcance)", value: fmtCurrency(cpm), status: s, weight: 3,
      benchmark: "Benchmark Meta BR (awareness): Excelente <R$10 · Saudável R$10–20 · Atenção R$20–50 · Crítico >R$50",
      tip: s === "excellent"
        ? `CPM excelente (<R$10) para awareness! Custo de alcance muito baixo. Escale o orçamento para maximizar o reconhecimento de marca.`
        : s === "good"
        ? `CPM eficiente (R$${fmt(cpm,2)}) para reconhecimento. Para reduzir ainda mais, use públicos amplos sem interesse específico e deixe a IA da Meta otimizar.`
        : s === "warning"
        ? `CPM moderado (R$${fmt(cpm,2)}). Segmentação talvez muito estreita. Amplie para públicos acima de 500k pessoas e teste o feed do Instagram.`
        : `CPM alto (>R$50) para awareness. Segmentação excessivamente restrita ou concorrência alta. Use públicos amplos sem interesses ou lookalike de 5–10%.`,
    });
    // Frequência awareness: Excellent 1.5-3, Good 3-4, Warning 4-5, Critical >5 (or <1.2)
    if (frequency > 0) {
      const s2: HealthStatus =
        frequency >= 1.5 && frequency <= 3 ? "excellent" :
        frequency > 3 && frequency <= 4   ? "good" :
        frequency > 4 && frequency <= 5   ? "warning" : "critical";
      checks.push({
        key: "freq_awareness", label: "Frequência", value: fmt(frequency, 1), status: s2, weight: 2,
        benchmark: "Benchmark awareness: Excelente 1,5–3x · Saudável 3–4x · Atenção 4–5x · Saturado >5x",
        tip: s2 === "excellent"
          ? `Frequência ideal (${fmt(frequency,1)}x) para awareness. O público está recebendo a mensagem com a repetição certa para fixar a marca na memória.`
          : s2 === "good"
          ? `Frequência dentro do aceitável (${fmt(frequency,1)}x). A partir de 4x, monitore o CPM — tende a subir com a saturação do público.`
          : s2 === "warning"
          ? `Frequência elevada (${fmt(frequency,1)}x). O público começa a ignorar o anúncio. Atualize o criativo ou expanda o alcance geográfico.`
          : `Frequência saturada (>5x). Impacto negativo na percepção da marca. Pause o anúncio, renove o criativo e amplie significativamente o público.`,
      });
    }
  }

  if (isEngagement) {
    // CTR engajamento: Excellent >5%, Good 3-5%, Warning 1-3%, Critical <1%
    const s: HealthStatus = ctr >= 5 ? "excellent" : ctr >= 3 ? "good" : ctr >= 1 ? "warning" : "critical";
    checks.push({
      key: "ctr_eng", label: "CTR Engajamento", value: `${fmt(ctr, 2)}%`, status: s, weight: 3,
      benchmark: "Benchmark Meta BR (engajamento): Excelente >5% · Saudável 3–5% · Atenção 1–3% · Crítico <1%",
      tip: s === "excellent"
        ? `CTR excepcional (${fmt(ctr,2)}%) para engajamento! Conteúdo altamente relevante. Use este formato como base para criar séries de conteúdo similares.`
        : s === "good"
        ? `CTR saudável (${fmt(ctr,2)}%) para engajamento. Para ir além, use perguntas no copy ('Você sabia que...?'), enquetes nos stories e vídeos com gancho nos primeiros 3s.`
        : s === "warning"
        ? `CTR moderado (${fmt(ctr,2)}%). O conteúdo está pouco atrativo. Teste formatos de carrossel, reels curtos (15–30s) e posts com prova social visível.`
        : `CTR baixo (<1%) para engajamento. O conteúdo não está gerando interesse. Revise completamente: formato errado para o público, copy genérico ou imagem sem impacto.`,
    });
  }

  if (isVideo) {
    // View rate: Excellent >30%, Good 20-30%, Warning 10-20%, Critical <10%
    if (videoViews > 0 && impressions > 0) {
      const viewRate = (videoViews / impressions) * 100;
      const s: HealthStatus = viewRate >= 30 ? "excellent" : viewRate >= 20 ? "good" : viewRate >= 10 ? "warning" : "critical";
      checks.push({
        key: "view_rate", label: "Taxa de Visualização", value: `${fmt(viewRate, 1)}%`, status: s, weight: 3,
        benchmark: "Benchmark Meta BR (vídeo): Excelente >30% · Saudável 20–30% · Atenção 10–20% · Crítico <10%",
        tip: s === "excellent"
          ? `Taxa de visualização excepcional (${fmt(viewRate,1)}%)! O vídeo está prendendo atenção logo nos primeiros segundos. Crie mais conteúdo com este formato e gancho.`
          : s === "good"
          ? `Taxa saudável (${fmt(viewRate,1)}%). Para aumentar, melhore o hook dos primeiros 3 segundos — use uma pergunta intrigante ou uma cena de impacto no início.`
          : s === "warning"
          ? `Taxa moderada (${fmt(viewRate,1)}%). O vídeo perde espectadores cedo. Encurte para menos de 30s, adicione legenda em todos os frames e comece com o resultado, não com a introdução.`
          : `Taxa baixa (<10%). O vídeo não está sendo assistido. Revise o formato (use vertical 9:16 para mobile), adicione texto grande nos primeiros frames e elimine a intro lenta.`,
      });
    }
  }

  // ── Cálculo do score com 4 níveis ─────────────────────────────────────────
  if (checks.length === 0) {
    return { score: 50, grade: "C", status: "warning", checks: [], primaryIssue: "Dados insuficientes para análise." };
  }

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const weightedScore = checks.reduce((s, c) => {
    const pts = c.status === "excellent" ? 100 : c.status === "good" ? 75 : c.status === "warning" ? 40 : 0;
    return s + pts * c.weight;
  }, 0);

  const score = Math.round(weightedScore / totalWeight);
  const grade: HealthReport["grade"] =
    score >= 90 ? "A+" : score >= 75 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";
  const status: HealthStatus =
    score >= 85 ? "excellent" : score >= 60 ? "good" : score >= 35 ? "warning" : "critical";

  const primaryIssue = checks
    .filter((c) => c.status === "critical")
    .sort((a, b) => b.weight - a.weight)[0]?.tip ?? null;

  return { score, grade, status, checks, primaryIssue };
}

// ─── Health Components ────────────────────────────────────────────────────────

function HealthScoreBadge({ report, onClick }: { report: HealthReport; onClick?: () => void }) {
  const colors: Record<HealthStatus, string> = {
    excellent: "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/25",
    good: "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/25",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    critical: "text-rose-400 bg-rose-500/10 border-rose-500/25",
  };
  const Icon = report.status === "excellent" || report.status === "good" ? CheckCircle2 : report.status === "warning" ? AlertTriangle : XCircle;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer hover:opacity-80 ${colors[report.status]}`}
      title={`Score ${report.score}/100 — clique para ver diagnóstico`}
    >
      <Icon size={11} />
      {report.score}
      <span className="font-mono text-[10px] opacity-70">{report.grade}</span>
    </button>
  );
}

function HealthKpiDot({ status }: { status: HealthStatus }) {
  const cls: Record<HealthStatus, string> = {
    excellent: "bg-[#39FF14] shadow-[0_0_5px_rgba(57,255,20,0.6)]",
    good: "bg-[#39FF14] shadow-[0_0_5px_rgba(57,255,20,0.6)]",
    warning: "bg-amber-400",
    critical: "bg-rose-500 shadow-[0_0_5px_rgba(239,68,68,0.6)]",
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cls[status]}`} />;
}

function CampaignHealthPanel({ campaign, onClose }: { campaign: CampaignRow; onClose: () => void }) {
  const report = calcHealthScore(campaign);

  const statusLabel: Record<HealthStatus, string> = { excellent: "Excelente", good: "Saudável", warning: "Atenção", critical: "Crítico" };
  const statusColor: Record<HealthStatus, string> = {
    excellent: "text-[#39FF14]",
    good: "text-[#39FF14]",
    warning: "text-amber-400",
    critical: "text-rose-400",
  };
  const statusBg: Record<HealthStatus, string> = {
    excellent: "bg-[#39FF14]/8 border-[#39FF14]/20",
    good: "bg-[#39FF14]/8 border-[#39FF14]/20",
    warning: "bg-amber-500/8 border-amber-500/20",
    critical: "bg-rose-500/8 border-rose-500/20",
  };
  const StatusIcon = report.status === "excellent" || report.status === "good" ? CheckCircle2 : report.status === "warning" ? AlertTriangle : XCircle;

  const scoreArc = (score: number) => {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const offset = circ - (score / 100) * circ;
    return { circ, offset };
  };
  const { circ, offset } = scoreArc(report.score);
  const arcColor = report.status === "excellent" || report.status === "good" ? "#39FF14" : report.status === "warning" ? "#f59e0b" : "#f43f5e";

  const goodCount = report.checks.filter((c) => c.status === "good" || c.status === "excellent").length;
  const warnCount = report.checks.filter((c) => c.status === "warning").length;
  const critCount = report.checks.filter((c) => c.status === "critical").length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg bg-[#0a0a0a] border border-[#1a1a1a] rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/80 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#111] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-[#111] rounded-xl border border-[#1a1a1a]">
              <HeartPulse size={16} className={statusColor[report.status]} />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate max-w-[240px]">{campaign.name}</p>
              <p className="text-gray-600 text-xs font-mono mt-0.5">Diagnóstico de saúde</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Score visual */}
        <div className={`mx-5 mt-4 rounded-2xl border p-4 flex items-center gap-5 ${statusBg[report.status]}`}>
          {/* Arc score */}
          <div className="relative shrink-0">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r="36" fill="none" stroke="#1a1a1a" strokeWidth="7" />
              <circle
                cx="44" cy="44" r="36" fill="none"
                stroke={arcColor} strokeWidth="7"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 44 44)"
                style={{ filter: `drop-shadow(0 0 6px ${arcColor}40)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-black font-mono leading-none ${statusColor[report.status]}`}>{report.score}</span>
              <span className={`text-[10px] font-bold ${statusColor[report.status]} opacity-70`}>{report.grade}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon size={14} className={statusColor[report.status]} />
              <span className={`text-sm font-bold ${statusColor[report.status]}`}>{statusLabel[report.status]}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs text-[#39FF14]"><CheckCircle2 size={11} />{goodCount} ok</span>
              <span className="flex items-center gap-1 text-xs text-amber-400"><AlertTriangle size={11} />{warnCount} atenção</span>
              <span className="flex items-center gap-1 text-xs text-rose-400"><XCircle size={11} />{critCount} crítico</span>
            </div>
            {report.primaryIssue && (
              <p className="text-rose-400 text-[11px] mt-2 leading-snug line-clamp-2">{report.primaryIssue}</p>
            )}
          </div>
        </div>

        {/* KPIs list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          <p className="text-gray-600 text-[10px] uppercase tracking-wider font-semibold mb-3">Diagnóstico por KPI</p>
          {report.checks.map((c) => {
            const rowBg = c.status === "excellent" || c.status === "good"
              ? "border-[#39FF14]/15 bg-[#39FF14]/5"
              : c.status === "warning"
              ? "border-amber-500/15 bg-amber-500/5"
              : "border-rose-500/15 bg-rose-500/5";
            const valColor = c.status === "excellent" || c.status === "good" ? "text-[#39FF14]" : c.status === "warning" ? "text-amber-400" : "text-rose-400";
            const CIcon = c.status === "excellent" || c.status === "good" ? CheckCircle2 : c.status === "warning" ? AlertTriangle : XCircle;

            return (
              <div key={c.key} className={`rounded-xl border p-3 ${rowBg}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <CIcon size={12} className={valColor} />
                    <span className="text-white text-xs font-semibold">{c.label}</span>
                  </div>
                  <span className={`text-sm font-black font-mono ${valColor}`}>{c.value}</span>
                </div>
                <p className="text-gray-500 text-[11px] leading-relaxed">{c.tip}</p>
              </div>
            );
          })}
          {report.checks.length === 0 && (
            <div className="text-center py-8">
              <Info size={24} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Dados insuficientes para análise completa.</p>
              <p className="text-gray-700 text-xs mt-1">Aguarde a campanha gastar mais para gerar métricas.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#111] shrink-0">
          <p className="text-gray-700 text-[10px] text-center">
            Benchmarks baseados nas médias Meta Ads Brasil 2024 · Score 0–100
          </p>
        </div>
      </div>
    </div>
  );
}

function ObjectiveBadge({ objective }: { objective: string }) {
  const obj = OBJECTIVE_MAP[objective];
  if (!obj) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border text-gray-400 bg-gray-500/10 border-gray-500/20">
        <Megaphone size={10} />
        {objective ? objective.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase()) : "—"}
      </span>
    );
  }
  const Icon = obj.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border ${obj.color}`}>
      <Icon size={10} />{obj.label}
    </span>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return <span className="w-2 h-2 rounded-full bg-[#39FF14] shrink-0 shadow-[0_0_6px_rgba(57,255,20,0.5)]" title="Ativa" />;
  if (s === "PAUSED") return <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" title="Pausada" />;
  return <span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" title={status} />;
}

// ─── Campaign Action Menu ────────────────────────────────────────────────────

function CampaignActionMenu({
  campaignId,
  status,
  loading,
  onAction,
}: {
  campaignId: string;
  status: string;
  loading: boolean;
  onAction: (action: "status", value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const s = status.toUpperCase();
  const isActive = s === "ACTIVE";
  const isPaused = s === "PAUSED";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-[#1a1a1a] transition-all cursor-pointer disabled:opacity-40"
        title="Ações"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <MoreVertical size={14} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl min-w-[160px] py-1 overflow-hidden">
          {!isActive && (
            <button
              onClick={() => { onAction("status", "ACTIVE"); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-[#39FF14] hover:bg-[#39FF14]/10 transition-colors cursor-pointer"
            >
              <PlayCircle size={13} /> Ativar campanha
            </button>
          )}
          {!isPaused && (
            <button
              onClick={() => { onAction("status", "PAUSED"); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-yellow-400 hover:bg-yellow-400/10 transition-colors cursor-pointer"
            >
              <Pause size={13} /> Pausar campanha
            </button>
          )}
          <div className="border-t border-[#1a1a1a] my-1" />
          <button
            onClick={() => { onAction("status", "ARCHIVED"); setOpen(false); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-rose-400 hover:bg-rose-400/10 transition-colors cursor-pointer"
          >
            <Archive size={13} /> Arquivar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Budget Editor ───────────────────────────────────────────────────────────

function BudgetEditor({
  campaignId,
  currentDailyBudget,
  currentLifetimeBudget,
  loading,
  onSave,
}: {
  campaignId: string;
  currentDailyBudget?: string | null;
  currentLifetimeBudget?: string | null;
  loading: boolean;
  onSave: (type: "daily_budget" | "lifetime_budget", value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [budgetType, setBudgetType] = useState<"daily_budget" | "lifetime_budget">(
    currentLifetimeBudget && !currentDailyBudget ? "lifetime_budget" : "daily_budget"
  );
  const [value, setValue] = useState(() => {
    const raw = currentDailyBudget ?? currentLifetimeBudget;
    if (!raw) return "";
    const num = parseFloat(raw) / 100;
    return isNaN(num) ? "" : num.toFixed(2);
  });

  // Sync value and budgetType when parent props change (e.g. after saving)
  useEffect(() => {
    setBudgetType(currentLifetimeBudget && !currentDailyBudget ? "lifetime_budget" : "daily_budget");
    const raw = currentDailyBudget ?? currentLifetimeBudget;
    if (!raw) { setValue(""); return; }
    const num = parseFloat(raw) / 100;
    setValue(isNaN(num) ? "" : num.toFixed(2));
  }, [currentDailyBudget, currentLifetimeBudget]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasBudget = !!(currentDailyBudget || currentLifetimeBudget);

  const handleSave = () => {
    const num = parseFloat(value.replace(",", "."));
    if (isNaN(num) || num <= 0) return;
    onSave(budgetType, num);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#39FF14] transition-colors cursor-pointer disabled:opacity-40"
        title="Editar orçamento"
      >
        {hasBudget ? (
          <>
            <span className="font-mono">
              {currentDailyBudget
                ? `R$ ${(parseFloat(currentDailyBudget) / 100).toFixed(2)}/dia`
                : `R$ ${(parseFloat(currentLifetimeBudget!) / 100).toFixed(2)} total`}
            </span>
            <Pencil size={11} className="shrink-0" />
          </>
        ) : (
          <span className="text-gray-700 flex items-center gap-1"><Plus size={11} /> orçamento</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-[#111] border border-[#2a2a2a] rounded-xl shadow-2xl p-3 min-w-[220px]">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Editar orçamento</p>
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setBudgetType("daily_budget")}
              className={`flex-1 text-xs py-1.5 rounded-lg transition-all cursor-pointer ${budgetType === "daily_budget" ? "bg-[#39FF14]/15 text-[#39FF14]" : "text-gray-500 hover:text-gray-300 bg-[#0a0a0a]"}`}
            >Diário</button>
            <button
              onClick={() => setBudgetType("lifetime_budget")}
              className={`flex-1 text-xs py-1.5 rounded-lg transition-all cursor-pointer ${budgetType === "lifetime_budget" ? "bg-[#39FF14]/15 text-[#39FF14]" : "text-gray-500 hover:text-gray-300 bg-[#0a0a0a]"}`}
            >Vitalício</button>
          </div>
          <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-1.5 mb-2">
            <span className="text-gray-600 text-xs">R$</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="flex-1 bg-transparent text-white text-sm font-mono outline-none min-w-0"
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setOpen(false)} className="flex-1 text-xs py-1.5 rounded-lg text-gray-500 hover:text-gray-300 bg-[#0a0a0a] cursor-pointer">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={loading || !value}
              className="flex-1 text-xs py-1.5 rounded-lg bg-[#39FF14]/15 text-[#39FF14] hover:bg-[#39FF14]/25 transition-all cursor-pointer disabled:opacity-40"
            >
              {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Column Editor ──────────────────────────────────────────────────────────

interface ColumnDef {
  id: string;
  label: string;
  description?: string;
  group: string;
  getValue: (row: CampaignRow) => string;
  align?: "left" | "right";
  highlight?: boolean;
}

const COLUMN_GROUPS = ["Geral", "Alcance", "Custo", "Conversão", "Mensagens", "Vídeo", "Orçamento"];

const ALL_COLUMNS: ColumnDef[] = [
  // Geral
  { id: "objective", label: "Tipo", description: "Objetivo da campanha", group: "Geral", getValue: () => "", align: "left" },
  { id: "impressions", label: "Impressões", description: "Total de impressões", group: "Geral", getValue: (r) => fmtInt(r.impressions), align: "right" },
  { id: "clicks", label: "Cliques", description: "Total de cliques no link", group: "Geral", getValue: (r) => fmtInt(r.clicks), align: "right" },
  { id: "frequency", label: "Frequência", description: "Média de exibições por pessoa", group: "Geral", getValue: (r) => fmt(r.frequency, 2), align: "right" },
  // Alcance
  { id: "reach", label: "Alcance", description: "Pessoas únicas alcançadas", group: "Alcance", getValue: (r) => fmtInt(r.reach), align: "right" },
  // Custo
  { id: "spend", label: "Investimento", description: "Valor total gasto", group: "Custo", getValue: (r) => fmtCurrency(r.spend), align: "right" },
  { id: "total_spend", label: "Valor Total Usado", description: "Total investido no período", group: "Custo", getValue: (r) => fmtCurrency(r.spend), align: "right" },
  { id: "ctr", label: "CTR", description: "Taxa de cliques por impressão", group: "Custo", getValue: (r) => `${fmt(r.ctr, 2)}%`, align: "right", highlight: true },
  { id: "cpc", label: "CPC", description: "Custo por clique", group: "Custo", getValue: (r) => fmtCurrency(r.cpc), align: "right" },
  { id: "cpm", label: "CPM", description: "Custo por mil impressões", group: "Custo", getValue: (r) => fmtCurrency(r.cpm), align: "right" },
  // Conversão
  { id: "purchases", label: "Compras", description: "Total de compras via Pixel", group: "Conversão", getValue: (r) => { const p = getPurchases(r.actions); return p > 0 ? String(p) : "—"; }, align: "right" },
  { id: "revenue", label: "Receita", description: "Valor total das compras", group: "Conversão", getValue: (r) => { const v = getPurchaseValue(r.action_values); return v > 0 ? fmtCurrency(v) : "—"; }, align: "right" },
  { id: "roas", label: "ROAS", description: "Retorno sobre investimento", group: "Conversão", getValue: (r) => { const v = getPurchaseValue(r.action_values); const s = parseFloat(r.spend); return v > 0 && s > 0 ? `${(v / s).toFixed(2)}x` : "—"; }, align: "right", highlight: true },
  { id: "cpp", label: "Custo/Resultado", description: "Custo por conversão", group: "Conversão", getValue: (r) => { const p = getPurchases(r.actions); return p > 0 ? fmtCurrency(parseFloat(r.spend) / p) : "—"; }, align: "right" },
  { id: "leads", label: "Leads", description: "Total de leads gerados", group: "Conversão", getValue: (r) => { const a = r.actions?.find(x => x.action_type === "lead" || x.action_type === "offsite_conversion.fb_pixel_lead"); return a ? a.value : "—"; }, align: "right" },
  { id: "cost_per_lead", label: "Custo por Lead", description: "Investimento ÷ leads", group: "Conversão", getValue: (r) => {
    const a = r.actions?.find(x => x.action_type === "lead" || x.action_type === "offsite_conversion.fb_pixel_lead");
    const leads = parseInt(a?.value ?? "0", 10);
    const spend = parseFloat(r.spend);
    return leads > 0 && spend > 0 ? fmtCurrency(spend / leads) : "—";
  }, align: "right" },
  { id: "add_to_cart", label: "Add ao Carrinho", description: "Eventos de add ao carrinho", group: "Conversão", getValue: (r) => { const a = r.actions?.find(x => x.action_type === "offsite_conversion.fb_pixel_add_to_cart" || x.action_type === "add_to_cart"); return a ? a.value : "—"; }, align: "right" },
  { id: "initiate_checkout", label: "Iniciou Checkout", description: "Eventos de início de checkout", group: "Conversão", getValue: (r) => { const a = r.actions?.find(x => x.action_type === "offsite_conversion.fb_pixel_initiate_checkout" || x.action_type === "initiate_checkout"); return a ? a.value : "—"; }, align: "right" },
  // Mensagens
  { id: "messages", label: "Conversas Iniciadas", description: "Conversas por mensagem iniciadas", group: "Mensagens", getValue: (r) => { const a = r.actions?.find(x => x.action_type === "onsite_conversion.messaging_conversation_started_7d"); return a ? a.value : "—"; }, align: "right" },
  { id: "cost_per_message", label: "Custo por Conversa", description: "Custo por conversa/mensagem iniciada", group: "Mensagens", getValue: (r) => {
    const a = r.actions?.find(x => x.action_type === "onsite_conversion.messaging_conversation_started_7d");
    const msgs = parseInt(a?.value ?? "0", 10);
    const spend = parseFloat(r.spend);
    return msgs > 0 && spend > 0 ? fmtCurrency(spend / msgs) : "—";
  }, align: "right", highlight: true },
  { id: "link_clicks", label: "Cliques no Link", description: "Cliques diretos no link do anúncio", group: "Mensagens", getValue: (r) => { const a = r.actions?.find(x => x.action_type === "link_click"); return a ? a.value : fmtInt(r.clicks); }, align: "right" },
  // Vídeo
  { id: "video_views", label: "Visualizações Vídeo", description: "Total de visualizações de vídeo", group: "Vídeo", getValue: (r) => { const a = r.actions?.find(x => x.action_type === "video_view"); return a ? a.value : "—"; }, align: "right" },
  { id: "cost_per_video_view", label: "Custo por View", description: "Custo por visualização de vídeo", group: "Vídeo", getValue: (r) => {
    const a = r.actions?.find(x => x.action_type === "video_view");
    const views = parseInt(a?.value ?? "0", 10);
    const spend = parseFloat(r.spend);
    return views > 0 && spend > 0 ? fmtCurrency(spend / views) : "—";
  }, align: "right" },
  // Orçamento
  { id: "campaign_daily_budget", label: "Orçamento Diário (Campanha)", description: "Orçamento diário definido na campanha", group: "Orçamento", getValue: (r: any) => r.daily_budget ? fmtCurrency(parseFloat(r.daily_budget) / 100) : "—", align: "right" },
  { id: "campaign_lifetime_budget", label: "Orçamento Vitalício (Campanha)", description: "Orçamento total definido na campanha", group: "Orçamento", getValue: (r: any) => r.lifetime_budget ? fmtCurrency(parseFloat(r.lifetime_budget) / 100) : "—", align: "right" },
  { id: "budget_remaining", label: "Orçamento Restante", description: "Orçamento restante da campanha", group: "Orçamento", getValue: (r: any) => r.budget_remaining ? fmtCurrency(parseFloat(r.budget_remaining) / 100) : "—", align: "right" },
  { id: "adset_daily_budget", label: "Orçamento Diário (Conjunto)", description: "Soma dos orçamentos diários dos conjuntos de anúncios", group: "Orçamento", getValue: (r: any) => r.adset_daily_budget ? fmtCurrency(parseFloat(r.adset_daily_budget) / 100) : "—", align: "right" },
  { id: "adset_lifetime_budget", label: "Orçamento Vitalício (Conjunto)", description: "Soma dos orçamentos totais dos conjuntos de anúncios", group: "Orçamento", getValue: (r: any) => r.adset_lifetime_budget ? fmtCurrency(parseFloat(r.adset_lifetime_budget) / 100) : "—", align: "right" },
];

const DEFAULT_COLUMNS = ["objective", "spend", "impressions", "clicks", "ctr", "cpm", "purchases"];

function ColumnEditor({
  selected,
  onChange,
  onClose,
}: {
  selected: string[];
  onChange: (cols: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("Todos");
  const [localSelected, setLocalSelected] = useState<string[]>(selected);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"select" | "order">("select");

  const groups = ["Todos", ...COLUMN_GROUPS];

  const filtered = ALL_COLUMNS.filter((c) => {
    const matchSearch = c.label.toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchGroup = activeGroup === "Todos" || c.group === activeGroup;
    return matchSearch && matchGroup;
  });

  const toggle = (id: string) => {
    setLocalSelected((prev) =>
      prev.includes(id)
        ? prev.length <= 2 ? prev : prev.filter((c) => c !== id)
        : [...prev, id]
    );
  };

  // Drag-to-reorder das colunas selecionadas
  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setLocalSelected((prev) => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(dragId);
      const toIdx = arr.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, dragId);
      return arr;
    });
    setDragId(null);
    setDragOverId(null);
  };

  const selectedDefs = localSelected
    .map((id) => ALL_COLUMNS.find((c) => c.id === id))
    .filter(Boolean) as ColumnDef[];

  const apply = () => { onChange(localSelected); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:p-4 sm:pt-12 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl shadow-[#39FF14]/5 flex flex-col max-h-[92vh] sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-2">
            <Columns3 size={15} className="text-[#39FF14]" />
            <h3 className="text-white font-bold text-sm">Editor de Colunas</h3>
            <span className="text-[10px] font-mono bg-[#39FF14]/10 text-[#39FF14] px-2 py-0.5 rounded-md">
              {localSelected.length} ativas
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-600 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5">
            <X size={15} />
          </button>
        </div>

        {/* Mobile tab switcher */}
        <div className="flex sm:hidden gap-0 border-b border-[#1a1a1a] shrink-0">
          <button
            onClick={() => setMobilePanel("select")}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${mobilePanel === "select" ? "text-[#39FF14] border-b-2 border-[#39FF14]" : "text-gray-600"}`}
          >
            Métricas
          </button>
          <button
            onClick={() => setMobilePanel("order")}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${mobilePanel === "order" ? "text-[#39FF14] border-b-2 border-[#39FF14]" : "text-gray-600"}`}
          >
            Ordem ({localSelected.length})
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Painel esquerdo — seletor (sempre visível no desktop; visível no mobile quando mobilePanel=select) */}
          <div className={`flex-1 flex-col min-w-0 border-r border-[#1a1a1a] ${mobilePanel === "select" ? "flex" : "hidden sm:flex"}`}>
            {/* Busca */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar métrica..."
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl pl-8 pr-3 py-2.5 sm:py-2 text-sm text-white placeholder-gray-700 outline-none focus:border-[#39FF14]/30 transition-colors"
                />
              </div>
            </div>

            {/* Grupos */}
            <div className="flex gap-1 px-4 pb-2 overflow-x-auto shrink-0">
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg whitespace-nowrap font-medium transition-all cursor-pointer ${
                    activeGroup === g
                      ? "bg-[#39FF14]/15 text-[#39FF14]"
                      : "text-gray-600 hover:text-gray-300"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Lista de métricas */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
              {filtered.length === 0 && (
                <p className="text-gray-700 text-xs text-center py-8 font-mono">Nenhuma métrica encontrada</p>
              )}
              {filtered.map((col) => {
                const isActive = localSelected.includes(col.id);
                return (
                  <button
                    key={col.id}
                    onClick={() => toggle(col.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
                      isActive
                        ? "bg-[#39FF14]/8 border border-[#39FF14]/15"
                        : "hover:bg-white/[0.03] border border-transparent"
                    }`}
                  >
                    <div className={`w-5 h-5 sm:w-4 sm:h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      isActive ? "bg-[#39FF14] border-[#39FF14]" : "border-[#333] group-hover:border-[#39FF14]/40"
                    }`}>
                      {isActive && <Check size={11} className="text-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? "text-[#39FF14]" : "text-gray-300"}`}>
                        {col.label}
                      </p>
                      {col.description && (
                        <p className="text-[10px] text-gray-600 truncate">{col.description}</p>
                      )}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                      isActive ? "bg-[#39FF14]/10 text-[#39FF14]" : "bg-[#111] text-gray-700"
                    }`}>
                      {col.group}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Painel direito — ordem das ativas (sempre visível no desktop; visível no mobile quando mobilePanel=order) */}
          <div className={`sm:w-52 flex-col shrink-0 w-full ${mobilePanel === "order" ? "flex" : "hidden sm:flex"}`}>
            <p className="text-[10px] text-gray-600 uppercase font-semibold tracking-wider px-4 pt-4 pb-2 shrink-0">
              Ordem das colunas
            </p>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {selectedDefs.map((col, i) => (
                <div
                  key={col.id}
                  draggable
                  onDragStart={() => handleDragStart(col.id)}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDrop={() => handleDrop(col.id)}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  className={`flex items-center gap-2 px-2.5 py-2.5 sm:py-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                    dragOverId === col.id
                      ? "border-[#39FF14]/40 bg-[#39FF14]/8"
                      : "border-[#1a1a1a] hover:border-[#333]"
                  }`}
                >
                  <GripVertical size={12} className="text-gray-700 shrink-0" />
                  <span className="text-[10px] font-mono text-gray-600 w-4 shrink-0">{i + 1}</span>
                  <span className="text-xs text-gray-300 truncate flex-1">{col.label}</span>
                  <button
                    onClick={() => toggle(col.id)}
                    className="text-gray-700 hover:text-rose-400 transition-colors cursor-pointer shrink-0 p-1"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {selectedDefs.length === 0 && (
                <p className="text-gray-700 text-[10px] text-center py-4 font-mono">Nenhuma coluna</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-[#1a1a1a] flex items-center justify-between shrink-0">
          <button
            onClick={() => setLocalSelected(DEFAULT_COLUMNS)}
            className="text-xs text-gray-600 hover:text-[#39FF14] transition-colors cursor-pointer"
          >
            Restaurar padrão
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={apply}
              className="text-xs text-black bg-[#39FF14] hover:bg-[#2bcc10] font-bold px-5 py-2 sm:py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportCSV(rows: Record<string, any>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => headers.map((h) => {
      const val = row[h];
      if (Array.isArray(val)) return JSON.stringify(val);
      return String(val ?? "").replace(/;/g, ",");
    }).join(";")),
  ].join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-Componentes ────────────────────────────────────────────────────────

function DateDropdown({
  value, onChange, customSince, customUntil, onCustomChange,
}: {
  value: string;
  onChange: (v: string) => void;
  customSince?: string;
  customUntil?: string;
  onCustomChange?: (since: string, until: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localSince, setLocalSince] = useState(customSince ?? "");
  const [localUntil, setLocalUntil] = useState(customUntil ?? "");

  const selected = DATE_PRESETS.find((p) => p.value === value) ?? DATE_PRESETS[0];
  const displayLabel = value === "custom" && customSince && customUntil
    ? `${customSince.slice(5)} → ${customUntil.slice(5)}`
    : selected.label;

  const applyCustom = () => {
    if (!localSince || !localUntil) return;
    if (localSince > localUntil) return;
    onCustomChange?.(localSince, localUntil);
    onChange("custom");
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 bg-[#0c0c0c] border border-[#1a1a1a] text-sm px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:border-[#39FF14]/30 transition-all cursor-pointer">
        <Calendar size={14} className="text-[#39FF14]" />
        <span className="text-white font-medium hidden sm:inline">{displayLabel}</span>
        <span className="text-white font-medium sm:hidden text-xs">{displayLabel.replace("Últimos ", "")}</span>
        <ChevronDown size={14} className="text-gray-600" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-2 left-0 bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl shadow-2xl shadow-black/50 z-50 min-w-[220px] overflow-hidden">
            {DATE_PRESETS.filter((p) => p.value !== "custom").map((opt) => (
              <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`block w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${value === opt.value ? "bg-[#39FF14]/10 text-[#39FF14]" : "text-gray-400 hover:bg-white/5"}`}
              >{opt.label}</button>
            ))}
            {/* Separator + custom range */}
            <div className="border-t border-[#1a1a1a] p-3 space-y-2">
              <p className="text-gray-600 text-[10px] uppercase tracking-wider font-semibold">Período personalizado</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={localSince}
                  onChange={(e) => setLocalSince(e.target.value)}
                  className="flex-1 bg-[#111] border border-[#1a1a1a] text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#39FF14]/40 cursor-pointer"
                />
                <span className="text-gray-600 text-xs">→</span>
                <input
                  type="date"
                  value={localUntil}
                  onChange={(e) => setLocalUntil(e.target.value)}
                  className="flex-1 bg-[#111] border border-[#1a1a1a] text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#39FF14]/40 cursor-pointer"
                />
              </div>
              <button
                onClick={applyCustom}
                disabled={!localSince || !localUntil}
                className="w-full bg-[#39FF14] hover:bg-[#39FF14]/90 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-bold py-2 rounded-lg transition-all cursor-pointer"
              >
                Aplicar período
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function VariationBadge({ value, inverted }: { value: number | null; inverted?: boolean }) {
  if (value === null) return null;
  const isUp = inverted ? value < 0 : value > 0;
  const color = isUp ? "text-[#39FF14] bg-[#39FF14]/10" : "text-rose-400 bg-rose-500/10";
  const icon = value > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-lg font-mono ${color}`}>
      {icon}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

// ─── Neon Glassmorphism KPI Card ─────────────────────────────────────────────
function KPICard({ title, value, icon: Icon, sub, variation, variationInverted, level = 2, alert }: {
  title: string; value: string; icon: React.ElementType; sub?: string;
  variation?: number | null; variationInverted?: boolean;
  level?: 1 | 2 | 3;
  alert?: "positive" | "negative" | null;
}) {
  const isL1 = level === 1;
  const isL3 = level === 3;

  return (
    <div
      className={`relative rounded-2xl p-4 sm:p-5 transition-all duration-200 group cursor-default overflow-hidden
        hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(57,255,20,0.12)]
        ${isL1
          ? "bg-[#0B0F0D]/80 backdrop-blur-md border border-[#39FF14]/25 shadow-[0_0_15px_rgba(57,255,20,0.08)]"
          : isL3
          ? "bg-[#0B0F0D]/40 backdrop-blur-sm border border-[#1a1a1a]/60"
          : "bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#39FF14]/10"
        }`}
    >
      {/* Subtle inner glow for L1 */}
      {isL1 && <div className="absolute inset-0 bg-gradient-to-br from-[#39FF14]/[0.03] via-transparent to-transparent pointer-events-none" />}

      <div className="relative flex items-start justify-between mb-2 sm:mb-3">
        <div className={`p-2 sm:p-2.5 rounded-xl ${isL1 ? "bg-[#39FF14]/10 shadow-[0_0_8px_rgba(57,255,20,0.15)]" : "bg-[#111]/60"}`}>
          <Icon size={isL1 ? 18 : 15} className={`${isL1 ? "text-[#39FF14]" : isL3 ? "text-[#555]" : "text-[#39FF14]/80"}`} />
        </div>
        <VariationBadge value={variation ?? null} inverted={variationInverted} />
      </div>
      <p className={`relative text-[10px] sm:text-xs uppercase tracking-wider mb-1 font-semibold ${isL3 ? "text-[#444]" : "text-[#A0A0A0]"}`}>{title}</p>
      <p className={`relative tracking-tight font-mono ${
        isL1 ? "text-2xl sm:text-3xl font-bold text-white" : isL3 ? "text-base sm:text-lg font-medium text-[#A0A0A0]" : "text-xl sm:text-2xl font-semibold text-white"
      }`} style={isL1 ? { textShadow: "0 0 10px rgba(57,255,20,0.15)" } : undefined}>{value}</p>
      {sub && <p className={`relative text-[10px] sm:text-xs mt-1 truncate ${isL3 ? "text-[#3a3a3a]" : "text-[#666]"}`}>{sub}</p>}
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className="text-[#39FF14] text-sm font-bold font-mono">{value}%</span>
      </div>
      <div className="w-full h-2.5 bg-[#111] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#1a8a0a] to-[#39FF14] transition-all duration-700" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children, action }: {
  title: string; subtitle?: string; icon: React.ElementType; children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#39FF14]/10 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-[#39FF14]/5">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-[#39FF14]" />
          <div>
            <h3 className="text-white font-semibold text-sm sm:text-base">{title}</h3>
            {subtitle && <p className="text-[#A0A0A0] text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111]/95 backdrop-blur-sm border border-[#1a1a1a] rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-gray-500 mb-1 font-medium font-mono">{label}</p>
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
          <span className="text-gray-400">{e.name}:</span>
          <span className="text-white font-bold font-mono">
            {e.name === "Gasto" ? fmtCurrency(e.value) : fmtInt(e.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111]/95 border border-[#1a1a1a] rounded-xl p-3 shadow-2xl">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ background: payload[0].payload.color }} />
        <span className="text-white text-sm capitalize">{payload[0].name}</span>
        <span className="text-[#39FF14] text-sm font-bold font-mono">{payload[0].value}%</span>
      </div>
    </div>
  );
};

// ─── UTM Editor ─────────────────────────────────────────────────────────────

interface UTMEntry {
  id: string;
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  label: string;
}

const UTM_PRESETS = {
  source: ["facebook", "instagram", "google", "youtube", "tiktok", "email", "whatsapp"],
  medium: ["cpc", "cpm", "social", "email", "video", "banner", "stories", "reels"],
  content: ["criativo-a", "criativo-b", "video-1", "imagem-1", "carrossel", "stories-1"],
};

function buildUTMUrl(entry: UTMEntry): string {
  if (!entry.baseUrl) return "";
  try {
    const url = new URL(entry.baseUrl.startsWith("http") ? entry.baseUrl : `https://${entry.baseUrl}`);
    if (entry.source) url.searchParams.set("utm_source", entry.source);
    if (entry.medium) url.searchParams.set("utm_medium", entry.medium);
    if (entry.campaign) url.searchParams.set("utm_campaign", entry.campaign);
    if (entry.term) url.searchParams.set("utm_term", entry.term);
    if (entry.content) url.searchParams.set("utm_content", entry.content);
    return url.toString();
  } catch {
    return "";
  }
}

function newEntry(): UTMEntry {
  return { id: Math.random().toString(36).slice(2), baseUrl: "", source: "facebook", medium: "cpc", campaign: "", term: "", content: "", label: "" };
}

function UTMEditor() {
  const [entries, setEntries] = useState<UTMEntry[]>([newEntry()]);
  const [copied, setCopied] = useState<string | null>(null);
  const copiedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  const update = (id: string, field: keyof UTMEntry, value: string) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  };

  const copyUrl = (url: string, id: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  };

  const copyAll = () => {
    const text = entries
      .map((e) => {
        const url = buildUTMUrl(e);
        return url ? `${e.label || e.campaign || "Link"}: ${url}` : null;
      })
      .filter(Boolean)
      .join("\n");
    if (text) navigator.clipboard.writeText(text).catch(() => {});
  };

  const exportCSV = () => {
    const rows = entries.map((e) => ({
      Label: e.label || e.campaign || "",
      URL_Base: e.baseUrl,
      utm_source: e.source,
      utm_medium: e.medium,
      utm_campaign: e.campaign,
      utm_term: e.term,
      utm_content: e.content,
      URL_Final: buildUTMUrl(e),
    }));
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => (r as any)[h]).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "utms.csv";
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-sm">Editor de UTMs</h3>
          <p className="text-gray-600 text-xs mt-0.5 font-mono">Crie e gerencie links de rastreamento para suas campanhas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyAll} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#39FF14] bg-[#0a0a0a] border border-[#1a1a1a] px-3 py-1.5 rounded-lg transition-all cursor-pointer">
            <Copy size={12} /> Copiar todos
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs text-[#39FF14] bg-[#39FF14]/10 border border-[#39FF14]/20 px-3 py-1.5 rounded-lg cursor-pointer">
            <Download size={12} /> CSV
          </button>
          <button onClick={() => setEntries((p) => [...p, newEntry()])} className="flex items-center gap-1.5 text-xs text-black bg-[#39FF14] px-3 py-1.5 rounded-lg font-semibold cursor-pointer hover:bg-[#2bcc10] transition-colors">
            <Plus size={12} /> Novo link
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-4">
        {entries.map((entry, idx) => {
          const builtUrl = buildUTMUrl(entry);
          const isCopied = copied === entry.id;
          return (
            <div key={entry.id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden hover:border-[#39FF14]/15 transition-all">
              {/* Entry header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#111]">
                <div className="flex items-center gap-2">
                  <Link2 size={13} className="text-[#39FF14]" />
                  <input
                    value={entry.label}
                    onChange={(e) => update(entry.id, "label", e.target.value)}
                    placeholder={`Link ${idx + 1} — ex: Campanha Verão Criativo A`}
                    className="bg-transparent text-white text-sm font-medium placeholder-gray-700 outline-none w-full sm:w-72"
                  />
                </div>
                {entries.length > 1 && (
                  <button onClick={() => setEntries((p) => p.filter((e) => e.id !== entry.id))} className="p-1.5 text-gray-700 hover:text-rose-400 transition-colors cursor-pointer rounded-lg hover:bg-rose-500/10">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* URL base */}
                <div>
                  <label className="text-gray-600 text-[10px] uppercase font-semibold tracking-wider mb-1.5 block">URL de Destino *</label>
                  <input
                    value={entry.baseUrl}
                    onChange={(e) => update(entry.id, "baseUrl", e.target.value)}
                    placeholder="https://seusite.com.br/pagina"
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 outline-none focus:border-[#39FF14]/30 transition-colors font-mono"
                  />
                </div>

                {/* Parâmetros UTM */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Source */}
                  <div>
                    <label className="text-gray-600 text-[10px] uppercase font-semibold tracking-wider mb-1.5 block">
                      utm_source <span className="text-[#39FF14]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        value={entry.source}
                        onChange={(e) => update(entry.id, "source", e.target.value)}
                        placeholder="facebook"
                        list={`source-${entry.id}`}
                        className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 outline-none focus:border-[#39FF14]/30 transition-colors font-mono"
                      />
                      <datalist id={`source-${entry.id}`}>
                        {UTM_PRESETS.source.map((v) => <option key={v} value={v} />)}
                      </datalist>
                    </div>
                  </div>

                  {/* Medium */}
                  <div>
                    <label className="text-gray-600 text-[10px] uppercase font-semibold tracking-wider mb-1.5 block">
                      utm_medium <span className="text-[#39FF14]">*</span>
                    </label>
                    <input
                      value={entry.medium}
                      onChange={(e) => update(entry.id, "medium", e.target.value)}
                      placeholder="cpc"
                      list={`medium-${entry.id}`}
                      className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 outline-none focus:border-[#39FF14]/30 transition-colors font-mono"
                    />
                    <datalist id={`medium-${entry.id}`}>
                      {UTM_PRESETS.medium.map((v) => <option key={v} value={v} />)}
                    </datalist>
                  </div>

                  {/* Campaign */}
                  <div>
                    <label className="text-gray-600 text-[10px] uppercase font-semibold tracking-wider mb-1.5 block">
                      utm_campaign <span className="text-[#39FF14]">*</span>
                    </label>
                    <input
                      value={entry.campaign}
                      onChange={(e) => update(entry.id, "campaign", e.target.value)}
                      placeholder="campanha-verao-2025"
                      className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 outline-none focus:border-[#39FF14]/30 transition-colors font-mono"
                    />
                  </div>

                  {/* Term */}
                  <div>
                    <label className="text-gray-600 text-[10px] uppercase font-semibold tracking-wider mb-1.5 block">utm_term <span className="text-gray-700">(opcional)</span></label>
                    <input
                      value={entry.term}
                      onChange={(e) => update(entry.id, "term", e.target.value)}
                      placeholder="palavra-chave"
                      className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 outline-none focus:border-[#39FF14]/30 transition-colors font-mono"
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <label className="text-gray-600 text-[10px] uppercase font-semibold tracking-wider mb-1.5 block">utm_content <span className="text-gray-700">(opcional)</span></label>
                    <input
                      value={entry.content}
                      onChange={(e) => update(entry.id, "content", e.target.value)}
                      placeholder="criativo-a"
                      list={`content-${entry.id}`}
                      className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 outline-none focus:border-[#39FF14]/30 transition-colors font-mono"
                    />
                    <datalist id={`content-${entry.id}`}>
                      {UTM_PRESETS.content.map((v) => <option key={v} value={v} />)}
                    </datalist>
                  </div>
                </div>

                {/* URL gerada */}
                {builtUrl && (
                  <div className="bg-[#111] border border-[#39FF14]/20 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-[#39FF14] uppercase font-semibold tracking-wider mb-1.5">URL Gerada</p>
                        <p className="text-gray-300 text-xs font-mono break-all leading-relaxed">{builtUrl}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={builtUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-600 hover:text-[#39FF14] transition-colors cursor-pointer rounded-lg hover:bg-[#39FF14]/10">
                          <ExternalLink size={14} />
                        </a>
                        <button onClick={() => copyUrl(builtUrl, entry.id)} className={`p-2 transition-colors cursor-pointer rounded-lg ${isCopied ? "text-[#39FF14] bg-[#39FF14]/10" : "text-gray-600 hover:text-[#39FF14] hover:bg-[#39FF14]/10"}`}>
                          {isCopied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    {/* Breakdown dos parâmetros */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#1a1a1a]">
                      {entry.source && <span className="text-[10px] font-mono bg-[#39FF14]/10 text-[#39FF14] px-2 py-0.5 rounded-md">source: {entry.source}</span>}
                      {entry.medium && <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md">medium: {entry.medium}</span>}
                      {entry.campaign && <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md">campaign: {entry.campaign}</span>}
                      {entry.term && <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-md">term: {entry.term}</span>}
                      {entry.content && <span className="text-[10px] font-mono bg-pink-500/10 text-pink-400 px-2 py-0.5 rounded-md">content: {entry.content}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Guia rápido */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4 sm:p-5">
        <h4 className="text-white font-bold text-sm mb-3">Guia Rápido de UTMs</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { param: "utm_source", desc: "Origem do tráfego", ex: "facebook, google", color: "text-[#39FF14]" },
            { param: "utm_medium", desc: "Canal de marketing", ex: "cpc, email, social", color: "text-blue-400" },
            { param: "utm_campaign", desc: "Nome da campanha", ex: "black-friday-2025", color: "text-purple-400" },
            { param: "utm_term", desc: "Palavra-chave paga", ex: "tenis-nike", color: "text-orange-400" },
            { param: "utm_content", desc: "Identifica o criativo", ex: "banner-top, btn-cta", color: "text-pink-400" },
          ].map((item) => (
            <div key={item.param} className="bg-[#111] rounded-xl p-3">
              <p className={`text-[10px] font-mono font-bold mb-1 ${item.color}`}>{item.param}</p>
              <p className="text-gray-400 text-[11px] mb-1">{item.desc}</p>
              <p className="text-gray-700 text-[10px] font-mono">{item.ex}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Multi-Account View ─────────────────────────────────────────────────────

interface ConsolidatedAccount {
  id: string;
  spend: string; impressions: string; clicks: string;
  ctr: string; cpm: string; reach: string;
  purchases: string; purchaseValue: string;
  roas: number | null; error?: boolean;
}

interface ConsolidatedTotals {
  spend: number; impressions: number; clicks: number;
  reach: number; purchases: number; purchaseValue: number;
  ctr: number; cpm: number; roas: number | null;
}

interface ConsolidatedData {
  accounts: ConsolidatedAccount[];
  totals: ConsolidatedTotals;
}

function MultiAccountView({ datePreset, accountNames }: { datePreset: string; accountNames: Record<string, string> }) {
  const [data, setData] = useState<ConsolidatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ids = Object.keys(accountNames).join(",");
      const qs = ids ? `date_preset=${datePreset}&ids=${ids}` : `date_preset=${datePreset}`;
      const res = await fetch(`/api/meta/consolidated?${qs}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao buscar dados consolidados");
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [datePreset, accountNames]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex flex-col items-center gap-4 py-20">
      <Loader2 size={28} className="text-[#39FF14] animate-spin" />
      <p className="text-gray-600 text-sm font-mono">Consolidando dados das contas...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center gap-4 py-20">
      <AlertCircle size={28} className="text-rose-400" />
      <p className="text-rose-400 text-sm text-center">{error}</p>
      <button onClick={load} className="flex items-center gap-2 bg-[#111] text-white text-sm px-4 py-2 rounded-xl transition-colors cursor-pointer hover:bg-[#1a1a1a]">
        <RefreshCw size={13} /> Tentar novamente
      </button>
    </div>
  );

  if (!data) return null;
  const { totals, accounts } = data;

  const consolidatedKpis = [
    { title: "Investimento Total", value: fmtCurrency(totals.spend), icon: DollarSign },
    { title: "Compras", value: fmtInt(totals.purchases), icon: Target, sub: `Receita: ${fmtCurrency(totals.purchaseValue)}` },
    { title: "ROAS Consolidado", value: totals.roas !== null ? `${totals.roas.toFixed(2)}x` : "N/A", icon: Zap },
    { title: "CPM Médio", value: fmtCurrency(totals.cpm), icon: BarChart3 },
    { title: "CTR Médio", value: `${totals.ctr.toFixed(2)}%`, icon: Activity },
    { title: "Alcance Total", value: fmtInt(totals.reach), icon: Eye },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs consolidados */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Briefcase size={14} className="text-[#39FF14]" />
          <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Visão Consolidada — {accounts.length} conta{accounts.length !== 1 ? "s" : ""}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {consolidatedKpis.map((kpi) => (
            <KPICard key={kpi.title} {...kpi} />
          ))}
        </div>
      </div>

      {/* Tabela por conta */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Table2 size={14} className="text-[#39FF14]" />
            <h3 className="text-white font-bold text-sm">Detalhamento por Conta</h3>
          </div>
          <button
            onClick={() => {
              const rows = accounts.map((a) => ({
                Conta: accountNames[a.id] ?? a.id,
                ID: a.id,
                Investimento: fmtCurrency(a.spend),
                Impressões: fmtInt(a.impressions),
                Cliques: fmtInt(a.clicks),
                CTR: `${fmt(a.ctr, 2)}%`,
                CPM: fmtCurrency(a.cpm),
                Compras: a.purchases,
                Receita: fmtCurrency(a.purchaseValue),
                ROAS: a.roas !== null ? `${a.roas.toFixed(2)}x` : "N/A",
              }));
              const headers = Object.keys(rows[0]);
              const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => (r as any)[h]).join(";"))].join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "multi-conta.csv"; a.click();
            }}
            className="flex items-center gap-1.5 text-xs text-[#39FF14] bg-[#39FF14]/10 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <Download size={12} /> CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px] sm:min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1a1a1a]">
                <th className="text-left text-gray-600 text-xs uppercase px-5 py-3 font-semibold">Conta</th>
                <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Investimento</th>
                <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Impressões</th>
                <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">CTR</th>
                <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">CPM</th>
                <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Compras</th>
                <th className="text-right text-gray-600 text-xs uppercase px-5 py-3 font-semibold">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-[#111] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-white font-medium text-sm">{accountNames[a.id] ?? a.id}</p>
                      <p className="text-gray-700 text-[10px] font-mono">{a.id}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-300 font-mono">{fmtCurrency(a.spend)}</td>
                  <td className="px-3 py-3 text-right text-gray-300 font-mono">{fmtInt(a.impressions)}</td>
                  <td className="px-3 py-3 text-right text-[#39FF14] font-semibold font-mono">{fmt(a.ctr, 2)}%</td>
                  <td className="px-3 py-3 text-right text-gray-300 font-mono">{fmtCurrency(a.cpm)}</td>
                  <td className="px-3 py-3 text-right text-white font-semibold font-mono">{fmtInt(a.purchases)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-mono font-bold ${a.roas !== null && a.roas >= 1 ? "text-[#39FF14]" : "text-gray-400"}`}>
                      {a.roas !== null ? `${a.roas.toFixed(2)}x` : "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Linha de totais */}
              <tr className="border-t border-[#39FF14]/20 bg-[#39FF14]/5">
                <td className="px-5 py-3 text-[#39FF14] font-bold text-xs uppercase tracking-wider">Total</td>
                <td className="px-3 py-3 text-right text-[#39FF14] font-bold font-mono">{fmtCurrency(totals.spend)}</td>
                <td className="px-3 py-3 text-right text-[#39FF14] font-bold font-mono">{fmtInt(totals.impressions)}</td>
                <td className="px-3 py-3 text-right text-[#39FF14] font-bold font-mono">{totals.ctr.toFixed(2)}%</td>
                <td className="px-3 py-3 text-right text-[#39FF14] font-bold font-mono">{fmtCurrency(totals.cpm)}</td>
                <td className="px-3 py-3 text-right text-[#39FF14] font-bold font-mono">{fmtInt(totals.purchases)}</td>
                <td className="px-5 py-3 text-right text-[#39FF14] font-bold font-mono">
                  {totals.roas !== null ? `${totals.roas.toFixed(2)}x` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Barra comparativa visual */}
      {accounts.length > 1 && (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5">
          <h3 className="text-white font-bold text-sm mb-4">Distribuição de Investimento</h3>
          <div className="space-y-3">
            {accounts.map((a) => {
              const pct = totals.spend > 0 ? (parseFloat(a.spend) / totals.spend) * 100 : 0;
              return (
                <div key={a.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs truncate max-w-[240px]">{accountNames[a.id] ?? a.id}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-gray-500 text-xs font-mono">{fmtCurrency(a.spend)}</span>
                      <span className="text-[#39FF14] text-xs font-bold font-mono w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-[#111] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#1a8a0a] to-[#39FF14] transition-all duration-700"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Link para gerenciar contas */}
      <div className="flex items-center justify-center pt-2">
        <a href="/select-account" className="flex items-center gap-2 text-xs text-gray-600 hover:text-[#39FF14] transition-colors cursor-pointer">
          <Briefcase size={12} /> Gerenciar contas selecionadas
        </a>
      </div>
    </div>
  );
}

// ─── Tab System ─────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }: { tabs: { id: string; label: string; icon: React.ElementType }[]; active: string; onChange: (id: string) => void }) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tabid="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);
  return (
    <div
      ref={scrollRef}
      className="flex gap-0.5 sm:gap-1 bg-[#0a0a0a] border border-[#1a1a1a] p-1 rounded-xl overflow-x-auto scrollbar-none max-w-full"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollSnapType: "x mandatory" }}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button key={t.id} data-tabid={t.id} onClick={() => onChange(t.id)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap cursor-pointer min-h-[44px] touch-manipulation ${
              isActive ? "bg-[#39FF14]/15 text-[#39FF14]" : "text-gray-500 hover:text-gray-300 active:bg-white/5"
            }`}
            style={{ scrollSnapAlign: "start" }}
          >
            <Icon size={12} className="sm:w-3.5 sm:h-3.5 shrink-0" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Bottom nav bar for mobile (fixed, app-style)
function MobileBottomNav({ tabs, active, onChange, onRefresh, onLogout, loading }: {
  tabs: { id: string; label: string; icon: React.ElementType }[];
  active: string;
  onChange: (id: string) => void;
  onRefresh: () => void;
  onLogout: () => void;
  loading: boolean;
}) {
  const primary = tabs.slice(0, 4);
  const secondary = tabs.slice(4);
  const [showMore, setShowMore] = React.useState(false);
  const moreActive = secondary.some(t => t.id === active);
  return (
    <>
      {/* Bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-[#1a1a1a] safe-bottom"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-stretch">
          {primary.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.id;
            return (
              <button key={t.id} onClick={() => { onChange(t.id); setShowMore(false); }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all touch-manipulation min-h-[56px] ${
                  isActive ? "text-[#39FF14]" : "text-gray-600 active:text-gray-300"
                }`}>
                <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${isActive ? "bg-[#39FF14]/15" : ""}`}>
                  <Icon size={18} />
                </div>
                <span className="text-[10px] font-medium leading-none">{t.label}</span>
              </button>
            );
          })}
          {/* Mais button */}
          <button onClick={() => setShowMore(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all touch-manipulation min-h-[56px] ${
              showMore || moreActive ? "text-[#39FF14]" : "text-gray-600 active:text-gray-300"
            }`}>
            <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${showMore || moreActive ? "bg-[#39FF14]/15" : ""}`}>
              <MoreHorizontal size={18} />
            </div>
            <span className="text-[10px] font-medium leading-none">Mais</span>
          </button>
        </div>
      </nav>

      {/* More drawer */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 bg-[#0a0a0a]/98 backdrop-blur-xl border-t border-[#1a1a1a] p-4"
            onClick={e => e.stopPropagation()}>
            <p className="text-[10px] uppercase tracking-widest text-[#333] font-semibold mb-3 px-1">Mais seções</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {secondary.map((t) => {
                const Icon = t.icon;
                const isActive = active === t.id;
                return (
                  <button key={t.id} onClick={() => { onChange(t.id); setShowMore(false); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all touch-manipulation min-h-[64px] ${
                      isActive ? "border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14]" : "border-[#1a1a1a] text-gray-500 active:bg-white/5"
                    }`}>
                    <Icon size={20} />
                    <span className="text-[10px] font-medium text-center leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Ações rápidas */}
            <div className="flex gap-2 border-t border-[#111] pt-3">
              <button onClick={() => { onRefresh(); setShowMore(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#1a1a1a] text-gray-400 active:bg-white/5 touch-manipulation min-h-[44px]">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                <span className="text-xs font-medium">Atualizar</span>
              </button>
              <button onClick={() => { onLogout(); setShowMore(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#1a1a1a] text-rose-400 active:bg-rose-500/10 touch-manipulation min-h-[44px]">
                <LogOut size={15} />
                <span className="text-xs font-medium">Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── AdsetPanel ─────────────────────────────────────────────────────────────

function AdsetStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/25",
    PAUSED: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    ARCHIVED: "text-gray-600 bg-gray-800/30 border-gray-700/25",
  };
  const labels: Record<string, string> = { ACTIVE: "Ativo", PAUSED: "Pausado", ARCHIVED: "Arquivado" };
  const cls = map[status] ?? "text-gray-500 bg-gray-800/20 border-gray-700/20";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${cls}`}>{labels[status] ?? status}</span>;
}

function AdsetPanel({
  adsets, loading, actionLoading, onStatusChange, onBudgetChange,
}: {
  adsets: AdsetRow[];
  loading: boolean;
  actionLoading: string | null;
  onStatusChange: (id: string, status: string) => void;
  onBudgetChange: (id: string, action: "daily_budget" | "lifetime_budget", value: number) => void;
}) {
  const [editBudget, setEditBudget] = useState<{ id: string; type: "daily_budget" | "lifetime_budget"; current: string } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [search, setSearch] = useState("");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const filtered = adsets.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.campaign_name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by campaign
  const grouped = filtered.reduce<Record<string, AdsetRow[]>>((acc, a) => {
    if (!acc[a.campaign_id]) acc[a.campaign_id] = [];
    acc[a.campaign_id].push(a);
    return acc;
  }, {});

  const GOAL_LABELS: Record<string, string> = {
    REACH: "Alcance", LINK_CLICKS: "Cliques", CONVERSIONS: "Conversões",
    LEAD_GENERATION: "Leads", APP_INSTALLS: "Instalações", VIDEO_VIEWS: "Visualizações",
    MESSAGES: "Mensagens", PAGE_LIKES: "Curtidas", POST_ENGAGEMENT: "Engajamento",
    LANDING_PAGE_VIEWS: "Visitas LP", OFFSITE_CONVERSIONS: "Conversões Pixel",
    VALUE: "Valor", QUALITY_LEAD: "Lead Qualificado",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-white font-bold text-base">Conjuntos de Anúncios</h2>
          <p className="text-gray-600 text-xs mt-0.5 font-mono">{adsets.length} conjuntos no período</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conjunto ou campanha..."
          className="bg-[#0c0c0c] border border-[#1a1a1a] text-sm text-white rounded-xl px-3 py-2 w-64 focus:outline-none focus:border-[#39FF14]/40 placeholder:text-gray-700"
        />
      </div>

      {loading && <div className="flex items-center justify-center py-16"><Loader2 size={28} className="text-[#39FF14] animate-spin" /></div>}

      {!loading && Object.keys(grouped).length === 0 && (
        <div className="text-center py-16 text-gray-700 text-sm">Nenhum conjunto encontrado</div>
      )}

      {!loading && Object.entries(grouped).map(([campId, sets]) => {
        const campName = sets[0].campaign_name;
        const isOpen = expandedCampaign === campId;
        return (
          <div key={campId} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
            {/* Campaign header */}
            <button
              onClick={() => setExpandedCampaign(isOpen && expandedCampaign === campId ? null : campId)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/2 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Megaphone size={13} className="text-[#39FF14] shrink-0" />
                <span className="text-white text-sm font-semibold truncate">{campName}</span>
                <span className="text-gray-600 text-xs font-mono shrink-0">{sets.length} conjunto{sets.length !== 1 ? "s" : ""}</span>
              </div>
              <ChevronDown size={14} className={`text-gray-600 transition-transform shrink-0 ${expandedCampaign === campId ? "rotate-180" : ""}`} />
            </button>

            {/* Adsets table */}
            {isOpen && (
              <div className="overflow-x-auto border-t border-[#111]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-600 border-b border-[#111]">
                      <th className="text-left px-4 py-2.5 font-semibold">Conjunto</th>
                      <th className="text-left px-3 py-2.5 font-semibold hidden sm:table-cell">Status</th>
                      <th className="text-left px-3 py-2.5 font-semibold hidden md:table-cell">Objetivo</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Gasto</th>
                      <th className="text-right px-3 py-2.5 font-semibold hidden sm:table-cell">Impressões</th>
                      <th className="text-right px-3 py-2.5 font-semibold">CTR</th>
                      <th className="text-right px-3 py-2.5 font-semibold hidden md:table-cell">CPC</th>
                      <th className="text-right px-3 py-2.5 font-semibold hidden lg:table-cell">CPM</th>
                      <th className="text-right px-3 py-2.5 font-semibold hidden md:table-cell">Orçamento</th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((a) => {
                      const budget = a.daily_budget ?? a.lifetime_budget;
                      const budgetType = a.daily_budget ? "daily_budget" : "lifetime_budget";
                      const budgetLabel = a.daily_budget ? "Diário" : "Total";
                      const isEditing = editBudget?.id === a.id;
                      const isMutating = actionLoading === a.id;
                      return (
                        <tr key={a.id} className="border-b border-[#0d0d0d] hover:bg-white/2 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-gray-300 font-medium truncate max-w-[160px] block">{a.name}</span>
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell"><AdsetStatusBadge status={a.status} /></td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            <span className="text-gray-500 text-[10px]">{GOAL_LABELS[a.optimization_goal] ?? a.optimization_goal}</span>
                          </td>
                          <td className="px-3 py-3 text-right text-white font-mono">R$ {fmt(a.spend)}</td>
                          <td className="px-3 py-3 text-right text-gray-400 font-mono hidden sm:table-cell">{parseInt(a.impressions, 10).toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-3 text-right text-gray-400 font-mono">{fmt(a.ctr)}%</td>
                          <td className="px-3 py-3 text-right text-gray-400 font-mono hidden md:table-cell">R$ {fmt(a.cpc)}</td>
                          <td className="px-3 py-3 text-right text-gray-400 font-mono hidden lg:table-cell">R$ {fmt(a.cpm)}</td>
                          <td className="px-3 py-3 text-right hidden md:table-cell">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-end">
                                <input
                                  type="number"
                                  value={budgetInput}
                                  onChange={(e) => setBudgetInput(e.target.value)}
                                  className="w-20 bg-[#111] border border-[#39FF14]/30 text-white text-xs rounded-lg px-2 py-1 focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    const val = parseFloat(budgetInput);
                                    if (!isNaN(val) && val > 0) onBudgetChange(a.id, editBudget.type, val);
                                    setEditBudget(null);
                                  }}
                                  className="p-1 text-[#39FF14] hover:bg-[#39FF14]/10 rounded cursor-pointer"
                                ><Check size={11} /></button>
                                <button onClick={() => setEditBudget(null)} className="p-1 text-gray-600 hover:text-white rounded cursor-pointer"><X size={11} /></button>
                              </div>
                            ) : budget ? (
                              <button
                                onClick={() => { setEditBudget({ id: a.id, type: budgetType as "daily_budget" | "lifetime_budget", current: budget }); setBudgetInput(String(parseFloat(budget) / 100)); }}
                                className="text-gray-500 hover:text-[#39FF14] font-mono text-right transition-colors cursor-pointer"
                              >
                                <span className="text-[9px] text-gray-700 mr-1">{budgetLabel}</span>
                                R$ {fmt(parseFloat(budget) / 100)}
                                <Pencil size={9} className="inline ml-1 opacity-50" />
                              </button>
                            ) : <span className="text-gray-700 text-[10px]">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              {isMutating ? <Loader2 size={12} className="animate-spin text-gray-500" /> : (
                                <>
                                  {a.status === "ACTIVE" && (
                                    <button onClick={() => onStatusChange(a.id, "PAUSED")} title="Pausar"
                                      className="p-1.5 rounded-lg text-gray-600 hover:text-amber-400 hover:bg-amber-400/10 transition-all cursor-pointer"><Pause size={11} /></button>
                                  )}
                                  {a.status === "PAUSED" && (
                                    <button onClick={() => onStatusChange(a.id, "ACTIVE")} title="Ativar"
                                      className="p-1.5 rounded-lg text-gray-600 hover:text-[#39FF14] hover:bg-[#39FF14]/10 transition-all cursor-pointer"><PlayCircle size={11} /></button>
                                  )}
                                  {a.status !== "ARCHIVED" && (
                                    <button onClick={() => onStatusChange(a.id, "ARCHIVED")} title="Arquivar"
                                      className="p-1.5 rounded-lg text-gray-600 hover:text-gray-400 hover:bg-gray-700/30 transition-all cursor-pointer"><Archive size={11} /></button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── AutoRulesPanel ──────────────────────────────────────────────────────────

const METRIC_OPTIONS: { value: RuleMetric; label: string; unit: string }[] = [
  { value: "roas", label: "ROAS", unit: "x" },
  { value: "ctr", label: "CTR", unit: "%" },
  { value: "cpm", label: "CPM", unit: "R$" },
  { value: "cpc", label: "CPC", unit: "R$" },
  { value: "spend", label: "Gasto Total", unit: "R$" },
  { value: "frequency", label: "Frequência", unit: "x" },
];

// ─── Creative Score Ranking ──────────────────────────────────────────────────

function calcCreativeScore(cr: CreativeRow, avgCtr: number, avgCpc: number): number {
  const ctr = parseFloat(cr.ctr ?? "0");
  const cpc = parseFloat(cr.cpc ?? "0");
  const spend = parseFloat(cr.spend ?? "0");
  const purchases = getPurchases(cr.actions ?? []);
  // CTR score (40 pts): CTR vs média
  const ctrScore = avgCtr > 0 ? Math.min((ctr / avgCtr) * 40, 60) : 0;
  // CPC score (30 pts): quanto menor vs média, melhor
  const cpcScore = avgCpc > 0 && cpc > 0 ? Math.min((avgCpc / cpc) * 30, 45) : 0;
  // Conversion score (30 pts): purchases per R$100 spend (1 purchase/R$100 = full score)
  const convScore = spend >= 1 ? Math.min((purchases / (spend / 100)) * 30, 30) : 0;
  // Volume score (10 pts): spend >= R$100 gets points
  const volScore = Math.min((spend / 1000) * 10, 10);
  return Math.min(Math.round(ctrScore + cpcScore + convScore + volScore), 100);
}

function CreativeScorePanel({ creatives, ads }: { creatives: CreativeRow[]; ads: AdRow[] }) {
  const [view, setView] = useState<"grid" | "table">("grid");

  const avgCtr = creatives.length > 0
    ? creatives.reduce((s, c) => s + parseFloat(c.ctr ?? "0"), 0) / creatives.length
    : 0;
  const cpcCreatives = creatives.filter((c) => parseFloat(c.cpc ?? "0") > 0);
  const avgCpc = cpcCreatives.length > 0
    ? cpcCreatives.reduce((s, c) => s + parseFloat(c.cpc ?? "0"), 0) / cpcCreatives.length
    : 0;

  const scored = [...creatives]
    .map((cr) => ({ ...cr, score: calcCreativeScore(cr, avgCtr, avgCpc) }))
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);

  function ScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/20"
      : score >= 60 ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
      : score >= 40 ? "text-orange-400 bg-orange-500/10 border-orange-500/20"
      : "text-rose-400 bg-rose-500/10 border-rose-500/20";
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold font-mono ${color}`}>
        <Star size={9} />{score}
      </span>
    );
  }

  function RankBadge({ rank }: { rank: number }) {
    const colors = ["text-yellow-400", "text-gray-300", "text-amber-600"];
    const labels = ["🥇", "🥈", "🥉"];
    return <span className={`text-base ${colors[rank] ?? "text-gray-700"}`}>{labels[rank] ?? `#${rank + 1}`}</span>;
  }

  if (creatives.length === 0) {
    return (
      <SectionCard title="Score de Criativos" subtitle="Ranking de performance" icon={Trophy}>
        <div className="py-12 text-center text-gray-700 text-sm font-mono">Nenhum criativo com dados no período</div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={15} className="text-yellow-400" />
            <h3 className="text-white font-bold text-sm">Top Criativos da Semana</h3>
            <span className="text-gray-600 text-xs ml-auto font-mono">Score baseado em CTR, CPC e Conversões</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {top3.map((cr, i) => (
              <div key={cr.id} className={`bg-[#111] border rounded-xl overflow-hidden transition-all ${i === 0 ? "border-yellow-400/30 shadow-lg shadow-yellow-400/5" : "border-[#1a1a1a]"}`}>
                {/* Thumbnail */}
                <div className="relative w-full bg-[#0c0c0c]" style={{ paddingTop: "56.25%" }}>
                  {cr.thumbnail_url ? (
                    <img src={cr.thumbnail_url} alt={cr.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><Image size={24} className="text-gray-800" /></div>
                  )}
                  <div className="absolute top-2 left-2"><RankBadge rank={i} /></div>
                  <div className="absolute top-2 right-2"><ScoreBadge score={cr.score} /></div>
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="text-gray-300 text-xs truncate mb-2 leading-tight">{cr.name}</p>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div><span className="text-gray-600 block">CTR</span><span className="text-[#39FF14] font-semibold font-mono">{fmt(cr.ctr, 2)}%</span></div>
                    <div><span className="text-gray-600 block">CPC</span><span className="text-white font-mono">{fmtCurrency(cr.cpc)}</span></div>
                    <div><span className="text-gray-600 block">Gasto</span><span className="text-white font-mono">{fmtCurrency(cr.spend)}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full ranking */}
      <SectionCard
        title="Ranking Completo"
        subtitle={`${scored.length} criativos analisados`}
        icon={Star}
        action={
          <div className="flex gap-1">
            <button onClick={() => setView("grid")} className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${view === "grid" ? "bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20" : "text-gray-600 hover:text-gray-400"}`}>Grid</button>
            <button onClick={() => setView("table")} className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${view === "table" ? "bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20" : "text-gray-600 hover:text-gray-400"}`}>Tabela</button>
          </div>
        }
      >
        {view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 sm:p-5">
            {scored.map((cr, idx) => (
              <div key={cr.id} className="bg-[#111] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#39FF14]/25 transition-all group flex flex-col">
                <div className="relative w-full bg-[#0c0c0c]" style={{ paddingTop: "100%" }}>
                  {cr.thumbnail_url ? (
                    <img src={cr.thumbnail_url} alt={cr.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      loading="lazy" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><Image size={28} className="text-gray-800" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-end justify-center opacity-0 group-hover:opacity-100 p-2">
                    <ScoreBadge score={cr.score} />
                  </div>
                  <div className="absolute top-1.5 left-1.5 bg-black/60 rounded-lg px-1.5 py-0.5 text-[9px] text-gray-400 font-mono">#{idx + 1}</div>
                </div>
                <div className="p-2.5 flex-1">
                  <p className="text-gray-300 text-[10px] truncate mb-1.5 leading-tight">{cr.name}</p>
                  <div className="flex items-center justify-between">
                    <ScoreBadge score={cr.score} />
                    <span className="text-gray-600 text-[10px] font-mono">{fmt(cr.ctr, 2)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px] sm:min-w-[600px]">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left text-gray-600 text-xs uppercase px-4 py-3 font-semibold w-8">#</th>
                  <th className="text-left text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Criativo</th>
                  <th className="text-center text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Score</th>
                  <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">CTR</th>
                  <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">CPC</th>
                  <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Gasto</th>
                  <th className="text-right text-gray-600 text-xs uppercase px-4 py-3 font-semibold">Cliques</th>
                </tr>
              </thead>
              <tbody>
                {scored.map((cr, idx) => (
                  <tr key={cr.id} className="border-b border-[#111] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {cr.thumbnail_url ? (
                          <img src={cr.thumbnail_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0"
                            referrerPolicy="no-referrer" crossOrigin="anonymous" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center shrink-0"><Image size={14} className="text-gray-700" /></div>
                        )}
                        <p className="text-white font-medium truncate max-w-[180px]">{cr.name}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center"><ScoreBadge score={cr.score} /></td>
                    <td className="px-3 py-3 text-right"><span className="text-[#39FF14] font-semibold font-mono">{fmt(cr.ctr, 2)}%</span></td>
                    <td className="px-3 py-3 text-right text-gray-300 font-mono">{fmtCurrency(cr.cpc)}</td>
                    <td className="px-3 py-3 text-right text-gray-300 font-mono">{fmtCurrency(cr.spend)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 font-mono">{fmtInt(cr.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Ads breakdown */}
      {ads.length > 0 && (
        <SectionCard title="Detalhamento por Anúncio" icon={FileText}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px] sm:min-w-[600px]">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left text-gray-600 text-xs uppercase px-4 sm:px-6 py-3 font-semibold">Anúncio</th>
                  <th className="text-left text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Conjunto</th>
                  <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Gasto</th>
                  <th className="text-right text-gray-600 text-xs uppercase px-3 py-3 font-semibold">CTR</th>
                  <th className="text-right text-gray-600 text-xs uppercase px-4 sm:px-6 py-3 font-semibold">CPC</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((a) => (
                  <tr key={a.id} className="border-b border-[#111] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 sm:px-6 py-3">
                      <p className="text-white font-medium truncate max-w-[200px]">{a.name}</p>
                      <p className="text-gray-700 text-xs truncate">{a.campaign_name}</p>
                    </td>
                    <td className="px-3 py-3"><p className="text-gray-500 text-xs truncate max-w-[120px]">{a.adset_name}</p></td>
                    <td className="px-3 py-3 text-right text-gray-300 font-medium font-mono">{fmtCurrency(a.spend)}</td>
                    <td className="px-3 py-3 text-right"><span className="text-[#39FF14] font-semibold font-mono">{fmt(a.ctr, 2)}%</span></td>
                    <td className="px-4 sm:px-6 py-3 text-right text-gray-300 font-mono">{fmtCurrency(a.cpc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Period Comparison Panel ─────────────────────────────────────────────────

interface CompPeriodData {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  roas: number | null;
  purchases: number;
}

function ComparisonPanel({ datePreset, customSince, customUntil }: {
  datePreset: string;
  customSince: string;
  customUntil: string;
}) {
  const [periodA, setPeriodA] = useState({ since: "", until: "" });
  const [periodB, setPeriodB] = useState({ since: "", until: "" });
  const [dataA, setDataA] = useState<CompPeriodData | null>(null);
  const [dataB, setDataB] = useState<CompPeriodData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with current period and previous equivalent
  useEffect(() => {
    const today = new Date();
    const fmt8 = (d: Date) => d.toISOString().slice(0, 10);
    if (datePreset === "today") {
      const t = fmt8(today);
      const y = fmt8(new Date(today.getTime() - 86400000));
      setPeriodA({ since: t, until: t });
      setPeriodB({ since: y, until: y });
    } else if (datePreset === "last_7d") {
      const end = fmt8(new Date(today.getTime() - 86400000));
      const start = fmt8(new Date(today.getTime() - 7 * 86400000));
      const prevEnd = fmt8(new Date(today.getTime() - 8 * 86400000));
      const prevStart = fmt8(new Date(today.getTime() - 14 * 86400000));
      setPeriodA({ since: start, until: end });
      setPeriodB({ since: prevStart, until: prevEnd });
    } else if (datePreset === "custom" && customSince && customUntil) {
      const diff = new Date(customUntil).getTime() - new Date(customSince).getTime();
      const prevEnd = fmt8(new Date(new Date(customSince).getTime() - 86400000));
      const prevStart = fmt8(new Date(new Date(customSince).getTime() - diff - 86400000));
      setPeriodA({ since: customSince, until: customUntil });
      setPeriodB({ since: prevStart, until: prevEnd });
    } else {
      // Default: last 7 days vs prev 7 days
      const end = fmt8(new Date(today.getTime() - 86400000));
      const start = fmt8(new Date(today.getTime() - 7 * 86400000));
      const prevEnd = fmt8(new Date(today.getTime() - 8 * 86400000));
      const prevStart = fmt8(new Date(today.getTime() - 14 * 86400000));
      setPeriodA({ since: start, until: end });
      setPeriodB({ since: prevStart, until: prevEnd });
    }
  }, [datePreset, customSince, customUntil]);

  const fetchPeriod = async (since: string, until: string, label: string): Promise<CompPeriodData | null> => {
    if (!since || !until) return null;
    const qs = `since=${since}&until=${until}`;
    const res = await fetch(`/api/meta/insights?${qs}`);
    if (!res.ok) return null;
    const d = await res.json();
    const ov = d.overview;
    if (!ov) return null;
    const spend = parseFloat(ov.spend ?? "0");
    const purchaseValue = parseFloat(ov.purchaseValue ?? "0");
    return {
      label,
      spend,
      impressions: parseFloat(ov.impressions ?? "0"),
      clicks: parseFloat(ov.clicks ?? "0"),
      ctr: parseFloat(ov.ctr ?? "0"),
      cpm: parseFloat(ov.cpm ?? "0"),
      cpc: spend > 0 && parseFloat(ov.clicks ?? "0") > 0 ? spend / parseFloat(ov.clicks) : 0,
      roas: ov.roas,
      purchases: parseFloat(ov.purchases ?? "0"),
    };
  };

  const compare = async () => {
    if (!periodA.since || !periodA.until || !periodB.since || !periodB.until) return;
    setLoading(true);
    setError(null);
    try {
      const labelA = `${periodA.since} → ${periodA.until}`;
      const labelB = `${periodB.since} → ${periodB.until}`;
      const [a, b] = await Promise.all([
        fetchPeriod(periodA.since, periodA.until, labelA),
        fetchPeriod(periodB.since, periodB.until, labelB),
      ]);
      setDataA(a);
      setDataB(b);
    } catch {
      setError("Erro ao buscar dados dos períodos");
    } finally {
      setLoading(false);
    }
  };

  const delta = (a: number, b: number, invertedBetter = false): { pct: number; positive: boolean } | null => {
    if (b === 0) return null;
    const pct = ((a - b) / b) * 100;
    const positive = invertedBetter ? pct < 0 : pct > 0;
    return { pct, positive };
  };

  const metrics: Array<{ key: keyof Omit<CompPeriodData, "label">; label: string; fmt: (v: number | null) => string; invertedBetter?: boolean }> = [
    { key: "spend", label: "Investimento", fmt: (v) => fmtCurrency(v ?? 0) },
    { key: "impressions", label: "Impressões", fmt: (v) => fmtInt(v ?? 0) },
    { key: "clicks", label: "Cliques", fmt: (v) => fmtInt(v ?? 0) },
    { key: "ctr", label: "CTR", fmt: (v) => `${fmt(v ?? 0, 2)}%` },
    { key: "cpm", label: "CPM", fmt: (v) => fmtCurrency(v ?? 0), invertedBetter: true },
    { key: "cpc", label: "CPC", fmt: (v) => fmtCurrency(v ?? 0), invertedBetter: true },
    { key: "roas", label: "ROAS", fmt: (v) => v !== null ? `${fmt(v ?? 0, 2)}x` : "N/A" },
    { key: "purchases", label: "Compras", fmt: (v) => fmtInt(v ?? 0) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GitCompare size={15} className="text-[#39FF14]" />
        <h2 className="text-white font-bold text-base">Comparação de Períodos</h2>
        <p className="text-gray-600 text-xs ml-2">Selecione dois períodos para comparar métricas lado a lado</p>
      </div>

      {/* Period selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Período A", period: periodA, set: setPeriodA },
          { label: "Período B", period: periodB, set: setPeriodB },
        ].map(({ label, period, set }) => (
          <div key={label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">{label}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-600 text-xs mb-1 block">De</label>
                <input type="date" value={period.since}
                  onChange={(e) => set((p) => ({ ...p, since: e.target.value }))}
                  className="w-full bg-[#111] border border-[#1a1a1a] text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#39FF14]/40 [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-gray-600 text-xs mb-1 block">Até</label>
                <input type="date" value={period.until}
                  onChange={(e) => set((p) => ({ ...p, until: e.target.value }))}
                  className="w-full bg-[#111] border border-[#1a1a1a] text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#39FF14]/40 [color-scheme:dark]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={compare}
        disabled={loading || !periodA.since || !periodA.until || !periodB.since || !periodB.until}
        className="flex items-center gap-2 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black text-sm font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <GitCompare size={14} />}
        {loading ? "Comparando..." : "Comparar Períodos"}
      </button>

      {error && <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{error}</div>}

      {/* Comparison table */}
      {dataA && dataB && (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 border-b border-[#1a1a1a] bg-[#080808]">
            <div className="px-4 sm:px-6 py-3 text-gray-600 text-xs uppercase font-semibold">Métrica</div>
            <div className="px-4 sm:px-6 py-3 text-[#39FF14] text-xs uppercase font-semibold text-right">Período A<br /><span className="text-gray-700 text-[10px] normal-case font-normal">{dataA.label}</span></div>
            <div className="px-4 sm:px-6 py-3 text-blue-400 text-xs uppercase font-semibold text-right">Período B<br /><span className="text-gray-700 text-[10px] normal-case font-normal">{dataB.label}</span></div>
            <div className="px-4 sm:px-6 py-3 text-gray-600 text-xs uppercase font-semibold text-center">Delta A vs B</div>
          </div>
          {metrics.map((m) => {
            const valA = dataA[m.key] as number | null;
            const valB = dataB[m.key] as number | null;
            const d = (valA !== null && valB !== null) ? delta(valA, valB, m.invertedBetter) : null;
            return (
              <div key={m.key} className="grid grid-cols-4 border-b border-[#111] hover:bg-white/[0.015] transition-colors">
                <div className="px-4 sm:px-6 py-3.5 text-gray-400 text-sm font-medium">{m.label}</div>
                <div className="px-4 sm:px-6 py-3.5 text-right text-white font-semibold font-mono text-sm">{m.fmt(valA)}</div>
                <div className="px-4 sm:px-6 py-3.5 text-right text-gray-400 font-mono text-sm">{m.fmt(valB)}</div>
                <div className="px-4 sm:px-6 py-3.5 text-center">
                  {d ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-bold font-mono ${d.positive ? "text-[#39FF14]" : "text-rose-400"}`}>
                      {d.positive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                      {Math.abs(d.pct).toFixed(1)}%
                    </span>
                  ) : <span className="text-gray-700 text-xs">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!dataA && !dataB && !loading && (
        <div className="text-center py-16 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl">
          <GitCompare size={28} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Configure os dois períodos e clique em Comparar</p>
          <p className="text-gray-700 text-xs mt-1">Os períodos foram preenchidos automaticamente com base no filtro atual</p>
        </div>
      )}
    </div>
  );
}

function AutoRulesPanel({
  rules, campaigns, onSave, onRun,
}: {
  rules: AutoRule[];
  campaigns: CampaignRow[];
  onSave: (rules: AutoRule[]) => void;
  onRun: (rule: AutoRule) => Promise<string[]>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [runResult, setRunResult] = useState<{ ruleId: string; triggered: string[] } | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AutoRule, "id" | "lastTriggered">>({
    name: "", metric: "roas", operator: "lt", threshold: 2, action: "pause", enabled: true,
  });

  const addRule = () => {
    if (!form.name.trim()) return;
    const newRule: AutoRule = { ...form, id: crypto.randomUUID(), lastTriggered: null };
    onSave([...rules, newRule]);
    setShowForm(false);
    setForm({ name: "", metric: "roas", operator: "lt", threshold: 2, action: "pause", enabled: true });
  };

  const toggleRule = (id: string) => {
    onSave(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = (id: string) => {
    onSave(rules.filter((r) => r.id !== id));
  };

  const runRule = async (rule: AutoRule) => {
    setRunning(rule.id);
    try {
      const triggered = await onRun(rule);
      setRunResult({ ruleId: rule.id, triggered });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-base flex items-center gap-2"><Zap size={15} className="text-[#39FF14]" />Regras de Automação</h2>
          <p className="text-gray-600 text-xs mt-0.5">Ações automáticas baseadas em performance das campanhas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer"
        >
          <Plus size={13} /> Nova Regra
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-[#0a0a0a] border border-[#39FF14]/20 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">Criar nova regra</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-gray-500 text-xs mb-1.5 block">Nome da regra</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Pausar campanhas com ROAS baixo"
                className="w-full bg-[#111] border border-[#1a1a1a] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#39FF14]/40 placeholder:text-gray-700"
              />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">Métrica</label>
              <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as RuleMetric })}
                className="w-full bg-[#111] border border-[#1a1a1a] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer">
                {METRIC_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">Condição</label>
              <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as RuleOperator })}
                className="w-full bg-[#111] border border-[#1a1a1a] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer">
                <option value="lt">Menor que (&lt;)</option>
                <option value="gt">Maior que (&gt;)</option>
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">
                Valor {METRIC_OPTIONS.find((m) => m.value === form.metric)?.unit && `(${METRIC_OPTIONS.find((m) => m.value === form.metric)?.unit})`}
              </label>
              <input type="number" step="0.1" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#111] border border-[#1a1a1a] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#39FF14]/40" />
            </div>
            <div>
              <label className="text-gray-500 text-xs mb-1.5 block">Ação</label>
              <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as RuleAction })}
                className="w-full bg-[#111] border border-[#1a1a1a] text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer">
                <option value="pause">Pausar campanha</option>
                <option value="notify">Só notificar</option>
              </select>
            </div>
          </div>

          {/* Preview */}
          {form.name && (
            <div className="bg-[#111] rounded-xl px-4 py-3 border border-[#1a1a1a]">
              <p className="text-gray-500 text-xs mb-1">Prévia da regra:</p>
              <p className="text-white text-sm">
                <span className="text-[#39FF14]">{form.name}</span>
                {" — "}Se <span className="text-amber-400">{METRIC_OPTIONS.find((m) => m.value === form.metric)?.label}</span>
                {" "}{form.operator === "lt" ? "<" : ">"}{" "}
                <span className="text-white font-mono">{form.threshold}{METRIC_OPTIONS.find((m) => m.value === form.metric)?.unit}</span>
                {" → "}
                <span className="text-rose-400">{form.action === "pause" ? "Pausar campanha" : "Notificar"}</span>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={addRule} className="bg-[#39FF14] hover:bg-[#39FF14]/90 text-black text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer">Criar Regra</button>
            <button onClick={() => setShowForm(false)} className="bg-[#111] text-gray-400 text-sm px-4 py-2 rounded-xl hover:bg-[#1a1a1a] transition-all cursor-pointer">Cancelar</button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 && !showForm && (
        <div className="text-center py-16 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl">
          <Zap size={28} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhuma regra criada ainda</p>
          <p className="text-gray-700 text-xs mt-1">Crie regras para pausar campanhas automaticamente quando as métricas caírem</p>
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule) => {
          const metaOpt = METRIC_OPTIONS.find((m) => m.value === rule.metric);
          const isRunning = running === rule.id;
          const result = runResult?.ruleId === rule.id ? runResult.triggered : null;
          return (
            <div key={rule.id} className={`bg-[#0a0a0a] border rounded-2xl p-4 transition-all ${rule.enabled ? "border-[#1a1a1a]" : "border-[#111] opacity-60"}`}>
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button onClick={() => toggleRule(rule.id)} className="mt-0.5 cursor-pointer shrink-0">
                  {rule.enabled
                    ? <ToggleRight size={22} className="text-[#39FF14]" />
                    : <ToggleLeft size={22} className="text-gray-600" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">{rule.name}</span>
                    {rule.action === "pause" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold"><Pause size={9} />Pausar</span>
                    )}
                    {rule.action === "notify" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold"><BellRing size={9} />Notificar</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    Se <span className="text-amber-400">{metaOpt?.label}</span>{" "}
                    {rule.operator === "lt" ? "< " : "> "}
                    <span className="text-white font-mono">{rule.threshold}{metaOpt?.unit}</span>
                    {" "}<span className="text-gray-600">em qualquer campanha ativa</span>
                  </p>
                  {rule.lastTriggered && (
                    <p className="text-gray-700 text-[10px] mt-1 font-mono">Último acionamento: {new Date(rule.lastTriggered).toLocaleString("pt-BR")}</p>
                  )}
                  {result !== null && (
                    <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${result.length > 0 ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" : "bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14]"}`}>
                      {result.length > 0
                        ? `${result.length} campanha${result.length > 1 ? "s" : ""} atingida${result.length > 1 ? "s" : ""}: ${result.join(", ")}`
                        : "Nenhuma campanha atingiu a condição"}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => runRule(rule)}
                    disabled={isRunning || !rule.enabled}
                    title="Executar regra agora"
                    className="p-2 rounded-xl bg-[#111] hover:bg-[#39FF14]/10 text-gray-600 hover:text-[#39FF14] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  </button>
                  <button onClick={() => deleteRule(rule.id)} title="Excluir regra"
                    className="p-2 rounded-xl bg-[#111] hover:bg-rose-500/10 text-gray-600 hover:text-rose-400 transition-all cursor-pointer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {campaigns.length > 0 && rules.length > 0 && (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4">
          <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider mb-3">Campanhas monitoradas ({campaigns.length})</p>
          <div className="flex flex-wrap gap-2">
            {campaigns.filter((c) => c.status === "ACTIVE").map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#111] border border-[#1a1a1a] rounded-lg text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-[#39FF14] shadow-[0_0_4px_rgba(57,255,20,0.5)]" />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Principal ──────────────────────────────────────────────────────────────

export default function DashAdsPro({ accountInfo }: { accountInfo?: AccountInfo }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [datePreset, setDatePreset] = useState("today");
  const [customSince, setCustomSince] = useState<string>("");
  const [customUntil, setCustomUntil] = useState<string>("");
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [columnsSynced, setColumnsSynced] = useState(false);

  // Sync columns: Supabase (autoritativo) > localStorage > DEFAULT_COLUMNS
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/user/preferences", { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const remote: string[] | undefined = data?.preferences?.columns;
        if (remote && Array.isArray(remote) && remote.length > 0) {
          const valid = remote.filter((id: string) => ALL_COLUMNS.some(c => c.id === id));
          if (valid.length > 0) {
            setSelectedColumns(valid);
            try { localStorage.setItem("dashads_columns", JSON.stringify(valid)); } catch {}
            setColumnsSynced(true);
            return;
          }
        }
        // Supabase vazio → tenta localStorage
        try {
          const saved = localStorage.getItem("dashads_columns");
          if (saved) {
            const parsed: string[] = JSON.parse(saved);
            const valid = parsed.filter(id => ALL_COLUMNS.some(c => c.id === id));
            if (valid.length > 0) {
              setSelectedColumns(valid);
              fetch("/api/user/preferences", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ columns: valid }),
              }).catch(() => {});
            }
          }
        } catch {}
        setColumnsSynced(true);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        // Sem rede — usa localStorage
        try {
          const saved = localStorage.getItem("dashads_columns");
          if (saved) {
            const parsed: string[] = JSON.parse(saved);
            const valid = parsed.filter(id => ALL_COLUMNS.some(c => c.id === id));
            if (valid.length > 0) setSelectedColumns(valid);
          }
        } catch {}
        setColumnsSynced(true);
      });
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveColumns = useCallback((cols: string[]) => {
    setSelectedColumns(cols);
    try { localStorage.setItem("dashads_columns", JSON.stringify(cols)); } catch {}
    // Persiste no Supabase para sincronização cross-device
    fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns: cols }),
    }).then(r => {
      if (!r.ok) r.json().then(b => console.warn("[saveColumns] PATCH failed:", b?.error)).catch(() => {});
    }).catch((err) => console.warn("[saveColumns] PATCH error:", err));
  }, []);
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [healthPanel, setHealthPanel] = useState<CampaignRow | null>(null);

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [adsets, setAdsets] = useState<AdsetRow[]>([]);
  const [demographics, setDemographics] = useState<{ ageGender: DemoRow[]; region: DemoRow[] } | null>(null);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [rules, setRules] = useState<AutoRule[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dashads_rules");
      if (saved) setRules(JSON.parse(saved));
    } catch {}
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noConnection, setNoConnection] = useState<"no_account" | "no_token" | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // campaign/adset id being mutated
  const [actionError, setActionError] = useState<string | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

  // ── WhatsApp Reports state ──
  type WaConfig = { phone: string; zapi_instance: string; zapi_token: string; zapi_token_configured: boolean; schedule: string; schedule_hours: number[]; schedule_timezone: string; date_preset: string; enabled: boolean; last_sent_at?: string | null };
  const [waConfig, setWaConfig] = useState<WaConfig>({ phone: "", zapi_instance: "", zapi_token: "", zapi_token_configured: false, schedule: "manual", schedule_hours: [11, -1, -1, -1], schedule_timezone: "America/Sao_Paulo", date_preset: "today", enabled: false, last_sent_at: null });
  const [waSaving, setWaSaving] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waMsg, setWaMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [waPreview, setWaPreview] = useState<string | null>(null);
  const [waShowToken, setWaShowToken] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [highlightedCampaignId, setHighlightedCampaignId] = useState<string | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const highlightedCampaignRef = useRef<HTMLTableRowElement>(null);
  const actionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current); }, []);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup scroll timer on unmount
  useEffect(() => () => { if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current); }, []);

  // Navigate to campaigns tab and highlight a specific campaign
  const openCampaign = useCallback((campaignId: string, objective?: string) => {
    setHighlightedCampaignId(campaignId);
    if (objective) setCampaignFilter(objective);
    setActiveTab("campaigns");
    // Scroll to highlighted row after render
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      highlightedCampaignRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      scrollTimerRef.current = null;
    }, 150);
  }, []);

  const exportPdf = useCallback(async () => {
    if (!insights?.overview) return;
    setExportingPdf(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const ov = insights.overview;
      const dateLabel = DATE_PRESETS.find((p) => p.value === datePreset)?.label ?? datePreset;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();

      // Background
      pdf.setFillColor(5, 5, 5);
      pdf.rect(0, 0, W, H, "F");

      // Header stripe
      pdf.setFillColor(35, 255, 14);
      pdf.rect(0, 0, W, 1.5, "F");

      // Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(255, 255, 255);
      pdf.text("DashAds Pro", 14, 16);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text("Relatório de Performance — " + dateLabel, 14, 22);
      pdf.text("Gerado em: " + new Date().toLocaleString("pt-BR"), 14, 27);

      // Account name
      if (accountInfo?.adAccountName) {
        pdf.setTextColor(57, 255, 20);
        pdf.setFontSize(8);
        pdf.text("Conta: " + accountInfo.adAccountName, W - 14, 22, { align: "right" });
      }

      // KPIs grid
      const kpiData = [
        { label: "Investimento", value: fmtCurrency(ov.spend) },
        { label: "ROAS", value: ov.roas !== null ? `${fmt(ov.roas, 2)}x` : "N/A" },
        { label: "CTR", value: `${fmt(ov.ctr, 2)}%` },
        { label: "CPM", value: fmtCurrency(ov.cpm) },
        { label: "Compras", value: fmtInt(ov.purchases) },
        { label: "Alcance", value: fmtInt(ov.reach) },
      ];

      let y = 36;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(180, 180, 180);
      pdf.text("RESUMO EXECUTIVO", 14, y);
      y += 6;

      const boxW = (W - 28 - 10) / 3;
      const boxH = 18;
      kpiData.forEach((kpi, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 14 + col * (boxW + 5);
        const by = y + row * (boxH + 3);
        pdf.setFillColor(15, 15, 15);
        pdf.roundedRect(x, by, boxW, boxH, 2, 2, "F");
        pdf.setDrawColor(30, 30, 30);
        pdf.roundedRect(x, by, boxW, boxH, 2, 2, "S");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text(kpi.label.toUpperCase(), x + 4, by + 6);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(255, 255, 255);
        pdf.text(kpi.value, x + 4, by + 14);
      });
      y += 2 * (boxH + 3) + 8;

      // Top Campaigns
      if (campaigns.length > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(180, 180, 180);
        pdf.text("TOP CAMPANHAS", 14, y);
        y += 6;

        pdf.setFillColor(15, 15, 15);
        pdf.rect(14, y, W - 28, 7, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text("CAMPANHA", 18, y + 4.5);
        pdf.text("GASTO", W - 70, y + 4.5);
        pdf.text("CTR", W - 50, y + 4.5);
        pdf.text("STATUS", W - 30, y + 4.5);
        y += 7;

        const topCamps = [...campaigns].sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend)).slice(0, 8);
        topCamps.forEach((c) => {
          pdf.setFillColor(10, 10, 10);
          pdf.rect(14, y, W - 28, 7, "F");
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(220, 220, 220);
          const name = c.name.length > 38 ? c.name.slice(0, 36) + "…" : c.name;
          pdf.text(name, 18, y + 4.5);
          pdf.text(fmtCurrency(c.spend), W - 70, y + 4.5);
          pdf.text(`${fmt(c.ctr, 2)}%`, W - 50, y + 4.5);
          const statusColor = c.status === "ACTIVE" ? [57, 255, 20] : [150, 150, 150];
          pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
          pdf.text(c.status === "ACTIVE" ? "Ativo" : "Pausado", W - 30, y + 4.5);
          y += 7;
          if (y > H - 20) {
            pdf.addPage();
            pdf.setFillColor(5, 5, 5);
            pdf.rect(0, 0, W, H, "F");
            y = 14;
          }
        });
      }

      // Footer
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(50, 50, 50);
      pdf.text("DashAds Pro — dashboardpremium.vercel.app", W / 2, H - 6, { align: "center" });

      pdf.save(`dashads-relatorio-${datePreset}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error("PDF export error:", e);
    } finally {
      setExportingPdf(false);
    }
  }, [insights, campaigns, datePreset, accountInfo]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNoConnection(null);
    try {
      const qs = datePreset === "custom" && customSince && customUntil
        ? `since=${customSince}&until=${customUntil}`
        : `date_preset=${datePreset}`;
      const safeGet = (url: string) => fetch(url).catch(() => null);
      const [insRes, campRes, adsRes, demoRes, crRes, adsetRes] = await Promise.all([
        fetch(`/api/meta/insights?${qs}`),
        safeGet(`/api/meta/campaigns?${qs}`),
        safeGet(`/api/meta/ads?${qs}`),
        safeGet(`/api/meta/demographics?${qs}`),
        safeGet(`/api/meta/creatives?${qs}`),
        safeGet(`/api/meta/adsets?${qs}`),
      ]);

      if (!insRes.ok) {
        const d = await insRes.json();
        if (d.error === "Nenhuma conta selecionada") { setNoConnection("no_account"); return; }
        if (d.error === "Token do Facebook não disponível") { setNoConnection("no_token"); return; }
        throw new Error(d.error ?? "Erro ao buscar métricas");
      }
      setInsights(await insRes.json());
      if (campRes?.ok) { const d = await campRes.json(); setCampaigns(d.campaigns ?? []); }
      if (adsRes?.ok) { const d = await adsRes.json(); setAds(d.ads ?? []); }
      if (adsetRes?.ok) { const d = await adsetRes.json(); setAdsets(d.adsets ?? []); }
      if (demoRes?.ok) { setDemographics(await demoRes.json()); }
      if (crRes?.ok) { const d = await crRes.json(); setCreatives(d.creatives ?? []); }
      setLastRefreshed(new Date());
      setCountdown(300);
    } catch (e: any) {
      setError(e.message ?? "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  }, [datePreset, customSince, customUntil]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load WhatsApp config once on mount
  useEffect(() => {
    fetch("/api/reports/config")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.config) {
          const cfg = d.config;
          // Normalise schedule_hours: ensure array of 4 slots
          const raw: number[] = Array.isArray(cfg.schedule_hours) ? cfg.schedule_hours : [11, -1, -1, -1];
          const hours = [raw[0] ?? 11, raw[1] ?? -1, raw[2] ?? -1, raw[3] ?? -1];
          setWaConfig((prev) => ({ ...prev, ...cfg, schedule_hours: hours }));
        }
      })
      .catch(() => {});
  }, []);

  // Real-time auto-refresh every 5 minutes
  useRealtime({ interval: 300_000, enabled: realtimeEnabled, onTick: fetchAll });

  // Countdown timer — só recria quando realtimeEnabled muda
  // lastRefreshed reseta o countdown via setCountdown(300) dentro de fetchAll
  useEffect(() => {
    if (!realtimeEnabled) return;
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? 300 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [realtimeEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manage campaign/adset: change status or budget
  const manageEntity = useCallback(async (
    type: "campaign" | "adset" | "ad",
    id: string,
    action: "status" | "daily_budget" | "lifetime_budget",
    value: string | number
  ) => {
    setActionLoading(id);
    setActionError(null);
    try {
      const res = await fetch("/api/meta/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, action, value }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : data.error?.message ?? "Erro ao atualizar";
        throw new Error(errMsg);
      }
      // Optimistic update for status
      if (action === "status") {
        if (type === "campaign") {
          setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: String(value) } : c));
        }
        if (type === "adset") {
          setAdsets((prev) => prev.map((a) => a.id === id ? { ...a, status: String(value) } : a));
        }
      }
      // Refresh campaigns after budget change — usa período atual completo
      if (action === "daily_budget" || action === "lifetime_budget") {
        const qs = datePreset === "custom" && customSince && customUntil
          ? `since=${customSince}&until=${customUntil}`
          : `date_preset=${datePreset}`;
        fetch(`/api/meta/campaigns?${qs}`)
          .then((r) => r.ok ? r.json() : null)
          .then((d) => { if (d?.campaigns) setCampaigns(d.campaigns); });
      }
    } catch (e: any) {
      const msg = typeof e.message === "string" ? e.message : "Erro ao atualizar";
      setActionError(msg);
      if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
      actionErrorTimerRef.current = setTimeout(() => setActionError(null), 6000);
    } finally {
      setActionLoading(null);
    }
  }, [datePreset, customSince, customUntil]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("dashads_rules");
    localStorage.removeItem("dashads_columns");
    router.push("/login");
  };

  const userName = accountInfo?.userName?.trim() || "Admin";
  const initials = userName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";

  const ov = insights?.overview;
  const cmp = insights?.comparison;
  const fn = insights?.funnel;

  // Derived metrics for hierarchy + smart alerts
  const roasVal = ov?.roas ?? null;
  const ctrVal = ov ? parseFloat(ov.ctr) : null;
  const cpmVal = ov ? parseFloat(ov.cpm) : null;
  const purchasesVal = ov ? parseFloat(ov.purchases) : 0;
  const spendVal = ov ? parseFloat(ov.spend) : 0;
  const cpaVal = purchasesVal > 0 && spendVal > 0 ? spendVal / purchasesVal : null;

  const roasAlert: "positive" | "negative" | null = roasVal !== null ? (roasVal >= 3 ? "positive" : roasVal < 1 ? "negative" : null) : null;
  const ctrAlert: "positive" | "negative" | null = ctrVal !== null ? (ctrVal >= 3 ? "positive" : ctrVal < 1 ? "negative" : null) : null;
  const cpmAlert: "positive" | "negative" | null = cpmVal !== null ? (cpmVal > 80 ? "negative" : null) : null;

  const kpis = ov ? [
    // Level 1: Critical metrics
    { title: "Retorno (ROAS)", value: roasVal !== null ? `${fmt(roasVal, 2)}x` : "N/A", icon: Zap, sub: `Receita: ${fmtCurrency(ov.purchaseValue)}`, variation: cmp?.roas, level: 1 as const, alert: roasAlert },
    { title: "Custo/Resultado", value: cpaVal !== null ? fmtCurrency(cpaVal) : "N/A", icon: TrendingDown, sub: "Custo por conversão", variation: null, level: 1 as const, alert: null },
    { title: "Receita Total", value: fmtCurrency(ov.purchaseValue), icon: DollarSign, sub: `${fmtInt(ov.purchases)} compras`, variation: cmp?.purchases, level: 1 as const, alert: null },
    // Level 2: Important
    { title: "Investimento", value: fmtCurrency(ov.spend), icon: Target, sub: `Alcance: ${fmtInt(ov.reach)}`, variation: cmp?.spend, level: 2 as const, alert: null },
    { title: "CTR", value: `${fmt(ov.ctr, 2)}%`, icon: Activity, sub: `${fmtInt(ov.clicks)} cliques`, variation: cmp?.ctr, level: 2 as const, alert: ctrAlert },
    { title: "CPM", value: fmtCurrency(ov.cpm), icon: BarChart3, sub: `${fmtInt(ov.impressions)} imp.`, variation: cmp?.cpm, variationInverted: true, level: 2 as const, alert: cpmAlert },
  ] : [];

  const chartData = (insights?.daily ?? []).map((d) => ({ date: fmtDate(d.date), Gasto: d.spend, Impressões: d.impressions, Cliques: d.clicks }));

  const donutData = (insights?.platformBreakdown ?? []).map((p) => ({
    name: p.platform, value: p.percent, color: PLATFORM_COLORS[p.platform] ?? "#1a8a0a",
  }));

  const vr = insights?.videoRetention;
  const videoRetentionItems = vr ? [
    { label: "VV 25%", value: vr.p25 }, { label: "VV 50%", value: vr.p50 },
    { label: "VV 75%", value: vr.p75 }, { label: "VV 100%", value: vr.p100 },
  ] : [];

  // Funil real
  const funnelSteps = fn && fn.impressions > 0 ? [
    { label: "Impressões", value: fn.impressions, icon: Eye },
    { label: "Cliques no Link", value: fn.clicks, icon: MousePointerClick },
    ...(fn.landing_page_view > 0 ? [{ label: "Page View", value: fn.landing_page_view, icon: Monitor }] : []),
    ...(fn.view_content > 0 ? [{ label: "Visualização", value: fn.view_content, icon: Eye }] : []),
    ...(fn.add_to_cart > 0 ? [{ label: "Add Carrinho", value: fn.add_to_cart, icon: ShoppingCart }] : []),
    ...(fn.initiate_checkout > 0 ? [{ label: "Iniciar Checkout", value: fn.initiate_checkout, icon: Layers }] : []),
    ...(fn.purchase > 0 ? [{ label: "Compras", value: fn.purchase, icon: CheckCircle2 }] : []),
    ...(fn.lead > 0 ? [{ label: "Leads", value: fn.lead, icon: FileText }] : []),
  ].filter((s) => s.value > 0) : [];

  // Demographics
  const ageData = demographics?.ageGender
    ? Object.values(
        demographics.ageGender.reduce((acc: Record<string, { age: string; spend: number }>, r) => {
          const age = r.age ?? "?";
          if (!acc[age]) acc[age] = { age, spend: 0 };
          acc[age].spend += parseFloat(r.spend ?? "0");
          return acc;
        }, {})
      ).sort((a, b) => b.spend - a.spend)
    : [];

  const genderData = demographics?.ageGender
    ? Object.values(
        demographics.ageGender.reduce((acc: Record<string, { gender: string; spend: number }>, r) => {
          const g = r.gender === "male" ? "Masculino" : r.gender === "female" ? "Feminino" : "Outro";
          if (!acc[g]) acc[g] = { gender: g, spend: 0 };
          acc[g].spend += parseFloat(r.spend ?? "0");
          return acc;
        }, {})
      ) : [];

  const regionData = (demographics?.region ?? [])
    .map((r) => ({ region: r.region ?? "?", spend: parseFloat(r.spend ?? "0") }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  // Age donut data for demographics overview
  const totalAgeSpend = ageData.reduce((s, a) => s + a.spend, 0) || 1;
  const ageDonutColors = ["#39FF14", "#2bcc10", "#22aa0e", "#1a8a0a", "#126a06", "#0a4a04"];
  const ageDonutData = ageData.slice(0, 5).map((a, i) => ({
    name: a.age, value: Math.round((a.spend / totalAgeSpend) * 100), color: ageDonutColors[i] ?? "#1a8a0a",
  }));
  const othersAge = ageData.slice(5).reduce((s, a) => s + a.spend, 0);
  if (othersAge > 0) {
    ageDonutData.push({ name: "Outros", value: Math.round((othersAge / totalAgeSpend) * 100), color: "#333" });
  }

  // Monta mapa de nomes das contas (principal + extras) — memoizado para evitar re-fetch infinito no MultiAccountView
  const accountNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (accountInfo?.adAccountId) {
      map[accountInfo.adAccountId] = accountInfo.adAccountName;
    }
    const extraIds = accountInfo?.extraAccountIds ?? [];
    const extraNames = accountInfo?.extraAccountNames ?? [];
    extraIds.forEach((id, i) => {
      if (id) map[id] = extraNames[i] ?? id;
    });
    return map;
  }, [accountInfo?.adAccountId, accountInfo?.adAccountName, accountInfo?.extraAccountIds, accountInfo?.extraAccountNames]);

  const hasMultiAccounts = Object.keys(accountNames).length > 1;

  const TABS = [
    { id: "overview", label: "Geral", icon: LayoutDashboard },
    { id: "campaigns", label: "Campanhas", icon: Table2 },
    { id: "adsets", label: "Conjuntos", icon: Layers },
    { id: "creatives", label: "Criativos", icon: Image },
    { id: "demographics", label: "Público", icon: Users },
    { id: "comparison", label: "Comparar", icon: GitCompare },
    { id: "rules", label: "Regras", icon: Zap },
    { id: "multi", label: "Multi-Conta", icon: Briefcase },
    { id: "utm", label: "UTMs", icon: Link2 },
    { id: "reports", label: "Relatórios", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-black text-white antialiased overflow-x-hidden">
      {/* ── Neon accent line top ── */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#39FF14] to-transparent opacity-60" />

      {/* Header — glassmorphism */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-2xl border-b border-[#39FF14]/10">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 min-w-0">
            {/* Logo — glassmorphism pill */}
            <div className="flex items-center shrink-0">
              <div className="px-4 py-2 rounded-xl bg-[#0B0F0D]/80 backdrop-blur-md border border-[#39FF14]/20 shadow-[0_0_15px_rgba(57,255,20,0.08)]">
                <span className="text-xl font-black tracking-widest text-white leading-none" style={{ textShadow: "0 0 8px rgba(57,255,20,0.3)" }}>DAP</span>
              </div>
            </div>

            {/* Center: Tabs — flex-1 allows it to shrink/grow without pushing sides */}
            <div className="hidden md:flex flex-1 min-w-0 justify-center overflow-hidden">
              <TabBar tabs={TABS} active={activeTab} onChange={(t) => { setActiveTab(t); if (t !== "campaigns") setHighlightedCampaignId(null); }} />
            </div>

            {/* Right: Filtros + Ações — shrink-0 keeps it always visible */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto md:ml-0">
              <DateDropdown
                value={datePreset}
                onChange={setDatePreset}
                customSince={customSince}
                customUntil={customUntil}
                onCustomChange={(s, u) => { setCustomSince(s); setCustomUntil(u); }}
              />

              {/* Realtime toggle + countdown */}
              <div className="hidden lg:flex items-center gap-1.5 bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl px-2.5 py-1.5">
                <button
                  onClick={() => setRealtimeEnabled((v) => !v)}
                  title={realtimeEnabled ? "Pausar atualização automática" : "Ativar atualização automática"}
                  className={`flex items-center gap-1 text-[10px] font-mono transition-colors cursor-pointer ${realtimeEnabled ? "text-[#39FF14]" : "text-gray-600"}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${realtimeEnabled ? "bg-[#39FF14] shadow-[0_0_4px_rgba(57,255,20,0.7)] animate-pulse" : "bg-gray-700"}`} />
                  {realtimeEnabled ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}` : "pausado"}
                </button>
              </div>

              <button onClick={() => { fetchAll(); setCountdown(300); }} title="Atualizar"
                className="p-2 sm:p-2.5 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a] text-gray-500 hover:text-[#39FF14] hover:border-[#39FF14]/30 transition-all cursor-pointer">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>

              {insights && !loading && (
                <button onClick={exportPdf} disabled={exportingPdf} title="Exportar Relatório PDF"
                  className="hidden sm:flex items-center gap-1.5 p-2 sm:p-2.5 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a] text-gray-500 hover:text-[#39FF14] hover:border-[#39FF14]/30 transition-all cursor-pointer disabled:opacity-50">
                  {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                  <span className="hidden lg:inline text-xs">PDF</span>
                </button>
              )}

              {noConnection && (
                <a
                  href="/select-account"
                  className="flex items-center gap-1.5 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all shadow-md shadow-[#1877F2]/20 shrink-0"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="hidden sm:inline">Conectar Facebook</span>
                  <span className="sm:hidden">Conectar</span>
                </a>
              )}

              {!noConnection && accountInfo?.adAccountName && (
                <div className="hidden xl:flex items-center gap-2 bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl px-3 py-2 text-xs max-w-[160px]">
                  <div className="w-2 h-2 rounded-full bg-[#39FF14] shrink-0 shadow-[0_0_6px_rgba(57,255,20,0.5)]" />
                  <div className="min-w-0">
                    <p className="text-gray-400 truncate">{accountInfo.adAccountName}</p>
                    {accountInfo.businessName && <p className="text-gray-600 truncate text-[10px]">{accountInfo.businessName}</p>}
                  </div>
                  <a href="/select-account" className="shrink-0 text-gray-600 hover:text-[#39FF14] transition-colors"><ChevronDownIcon size={12} /></a>
                </div>
              )}

              <div className="flex items-center gap-1">
                {accountInfo?.role === "admin" && (
                  <a href="/admin" title="Painel Admin"
                    className="p-2 sm:p-2.5 rounded-xl bg-[#0c0c0c] border border-[#39FF14]/20 text-[#39FF14] hover:bg-[#39FF14]/10 transition-all">
                    <Shield size={14} className="sm:w-4 sm:h-4" />
                  </a>
                )}
                <a href="/crm" title="CRM"
                  className="p-2 sm:p-2.5 rounded-xl bg-[#0c0c0c] border border-[#39FF14]/20 text-[#39FF14] hover:bg-[#39FF14]/10 transition-all">
                  <Columns3 size={14} className="sm:w-4 sm:h-4" />
                </a>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#39FF14] to-[#1a8a0a] flex items-center justify-center text-black font-bold text-xs sm:text-sm shadow-lg shadow-[#39FF14]/20 shrink-0">
                  {initials}
                </div>
                <button onClick={handleLogout} disabled={loggingOut} title="Sair"
                  className="p-2 sm:p-2.5 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a] text-gray-600 hover:text-rose-400 hover:border-rose-500/30 transition-all disabled:opacity-50 cursor-pointer shrink-0">
                  <LogOut size={14} className="sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile tabs — scroll horizontal compacta no header */}
          <div className="md:hidden mt-2">
            <TabBar tabs={TABS} active={activeTab} onChange={(t) => { setActiveTab(t); if (t !== "campaigns") setHighlightedCampaignId(null); }} />
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      {/* Action error toast */}
      {actionError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-rose-950 border border-rose-500/40 text-rose-300 text-sm px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4">
          <AlertCircle size={16} className="shrink-0" />
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-2 text-rose-500 hover:text-rose-300 cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <MobileBottomNav tabs={TABS} active={activeTab} onChange={(t) => { setActiveTab(t); if (t !== "campaigns") setHighlightedCampaignId(null); }} onRefresh={() => { fetchAll(); setCountdown(300); }} onLogout={handleLogout} loading={loading} />

      <main className="max-w-[1920px] mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-20 md:pb-6 space-y-4 sm:space-y-6">

        {loading && (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 size={32} className="text-[#39FF14] animate-spin" />
            <p className="text-gray-600 text-sm font-mono">Carregando métricas...</p>
          </div>
        )}

        {/* ── Empty state: sem conta / sem token ── */}
        {!loading && noConnection && (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-full max-w-sm bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 flex flex-col items-center gap-6">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-[#1877F2]/10 border border-[#1877F2]/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#1877F2]" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>

              {/* Text */}
              <div className="text-center space-y-2">
                <h2 className="text-white font-bold text-lg">
                  {noConnection === "no_token" ? "Conecte sua conta do Facebook" : "Selecione uma conta de anúncios"}
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {noConnection === "no_token"
                    ? "Para ver suas métricas, conecte sua conta do Facebook Ads e autorize o acesso aos dados de campanha."
                    : "Você tem uma conta conectada, mas ainda não selecionou uma conta de anúncios para visualizar."}
                </p>
              </div>

              {/* CTA */}
              {noConnection === "no_token" ? (
                <a
                  href="/select-account"
                  className="w-full flex items-center justify-center gap-2.5 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-[#1877F2]/20"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Conectar Facebook Ads
                </a>
              ) : (
                <a
                  href="/select-account"
                  className="w-full flex items-center justify-center gap-2.5 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-semibold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-[#39FF14]/20"
                >
                  <Target size={15} />
                  Selecionar conta de anúncios
                </a>
              )}

              <p className="text-gray-700 text-xs text-center">
                Precisa de ajuda?{" "}
                <a href="/select-account" className="text-gray-500 hover:text-[#39FF14] transition-colors underline underline-offset-2">
                  Ver guia de configuração
                </a>
              </p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-4 py-20">
            <AlertCircle size={32} className="text-rose-400" />
            <p className="text-rose-400 text-sm text-center">{error}</p>
            <button onClick={fetchAll} className="flex items-center gap-2 bg-[#111] hover:bg-[#1a1a1a] text-white text-sm px-4 py-2 rounded-xl transition-colors cursor-pointer">
              <RefreshCw size={14} /> Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && insights && (
          <>
            {/* ═══ KPI ROW — dinâmico baseado em selectedColumns ═══ */}
            {(() => {
              const BUDGET_COLS = new Set(["campaign_daily_budget","campaign_lifetime_budget","budget_remaining","adset_daily_budget","adset_lifetime_budget"]);
              const SKIP_COLS = new Set(["objective","impressions","spend","total_spend",...BUDGET_COLS]);

              // Compute action-based values from campaigns array
              const sumCampAction = (actionType: string): number =>
                campaigns.reduce((acc, c) => {
                  const a = c.actions?.find(x => x.action_type === actionType);
                  return acc + (a ? parseInt(a.value, 10) : 0);
                }, 0);
              const sumCampActionValue = (actionType: string): number =>
                campaigns.reduce((acc, c) => {
                  const a = c.action_values?.find(x => x.action_type === actionType);
                  return acc + (a ? parseFloat(a.value) : 0);
                }, 0);

              const dynLeads = sumCampAction("lead") || sumCampAction("offsite_conversion.fb_pixel_lead");
              const dynMsgs = sumCampAction("onsite_conversion.messaging_conversation_started_7d");
              const dynLinkClicks = sumCampAction("link_click");
              const dynAddCart = sumCampAction("offsite_conversion.fb_pixel_add_to_cart") || sumCampAction("add_to_cart");
              const dynCheckout = sumCampAction("offsite_conversion.fb_pixel_initiate_checkout") || sumCampAction("initiate_checkout");
              const dynVideoViews = sumCampAction("video_view");
              const dynPurchases = sumCampAction("offsite_conversion.fb_pixel_purchase") || sumCampAction("purchase") || sumCampAction("omni_purchase");

              type KpiCard = { id: string; label: string; value: string; icon: React.ElementType; alert: "positive"|"negative"|null; sub?: string };
              const colToKpi = (colId: string): KpiCard | null => {
                switch (colId) {
                  case "ctr": return { id: colId, label: "CTR", value: `${fmt(ov?.ctr ?? 0, 2)}%`, icon: Activity, alert: ctrAlert };
                  case "cpm": return { id: colId, label: "CPM", value: fmtCurrency(ov?.cpm ?? 0), icon: BarChart3, alert: cpmAlert };
                  case "cpc": { const cpcClicks = ov ? parseFloat(ov.clicks) : 0; return { id: colId, label: "CPC", value: cpcClicks > 0 ? fmtCurrency(parseFloat(ov!.spend) / cpcClicks) : "—", icon: MousePointerClick, alert: null }; }
                  case "clicks": return { id: colId, label: "Cliques", value: fmtInt(ov?.clicks ?? 0), icon: MousePointerClick, alert: null };
                  case "reach": return { id: colId, label: "Alcance", value: fmtInt(ov?.reach ?? 0), icon: Users, alert: null };
                  case "frequency": {
                    // Triple fallback: 1) overview.frequency from API
                    // 2) overview impressions/reach
                    // 3) spend-weighted average from campaigns (most reliable for "today" preset)
                    let freqVal = ov ? parseFloat(ov.frequency ?? "0") : 0;
                    if (freqVal <= 0 && ov) {
                      const ovImpr = parseFloat(ov.impressions ?? "0");
                      const ovReach = parseFloat(ov.reach ?? "0");
                      if (ovReach > 0 && ovImpr > 0) freqVal = ovImpr / ovReach;
                    }
                    if (freqVal <= 0 && campaigns.length > 0) {
                      const totalSpend = campaigns.reduce((s, c) => s + parseFloat(c.spend ?? "0"), 0);
                      if (totalSpend > 0) {
                        freqVal = campaigns.reduce((s, c) => s + parseFloat(c.frequency ?? "0") * parseFloat(c.spend ?? "0"), 0) / totalSpend;
                      }
                    }
                    return { id: colId, label: "Frequência", value: freqVal > 0 ? `${fmt(freqVal, 2)}x` : "—", icon: BarChart3, alert: null };
                  }
                  case "purchases": return { id: colId, label: "Compras", value: fmtInt(ov?.purchases ?? 0), icon: ShoppingCart, alert: null };
                  case "revenue": return { id: colId, label: "Receita", value: fmtCurrency(ov?.purchaseValue ?? 0), icon: DollarSign, alert: null };
                  case "roas": return { id: colId, label: "ROAS", value: roasVal !== null ? `${fmt(roasVal, 2)}x` : "N/A", icon: Zap, alert: roasAlert };
                  case "cpp": return { id: colId, label: "Custo/Resultado", value: cpaVal !== null ? fmtCurrency(cpaVal) : "N/A", icon: TrendingDown, alert: null };
                  case "leads": return { id: colId, label: "Leads", value: dynLeads > 0 ? fmtInt(dynLeads) : "N/A", icon: UserPlus, alert: null };
                  case "cost_per_lead": return { id: colId, label: "Custo/Lead", value: dynLeads > 0 ? fmtCurrency(spendVal / dynLeads) : "N/A", icon: UserPlus, alert: null };
                  case "messages": return { id: colId, label: "Mensagens", value: dynMsgs > 0 ? fmtInt(dynMsgs) : "N/A", icon: MessageCircle, alert: null };
                  case "cost_per_message": return { id: colId, label: "Custo/Msg", value: dynMsgs > 0 ? fmtCurrency(spendVal / dynMsgs) : "N/A", icon: MessageCircle, alert: null };
                  case "link_clicks": return { id: colId, label: "Cliques no Link", value: dynLinkClicks > 0 ? fmtInt(dynLinkClicks) : fmtInt(ov?.clicks ?? 0), icon: Globe, alert: null };
                  case "add_to_cart": return { id: colId, label: "Add Carrinho", value: dynAddCart > 0 ? fmtInt(dynAddCart) : "N/A", icon: ShoppingCart, alert: null };
                  case "initiate_checkout": return { id: colId, label: "Checkout", value: dynCheckout > 0 ? fmtInt(dynCheckout) : "N/A", icon: Layers, alert: null };
                  case "video_views": return { id: colId, label: "Views Vídeo", value: dynVideoViews > 0 ? fmtInt(dynVideoViews) : "N/A", icon: Video, alert: null };
                  case "cost_per_video_view": return { id: colId, label: "Custo/View", value: dynVideoViews > 0 ? fmtCurrency(spendVal / dynVideoViews) : "N/A", icon: Video, alert: null };
                  default: return null;
                }
              };

              const activeKpis = selectedColumns
                .filter(c => !SKIP_COLS.has(c))
                .map(colToKpi)
                .filter((k): k is KpiCard => k !== null);

              // Adsets com custo por mensagem — usado quando cost_per_message está ativo
              const adsetMsgCards: Array<{ id: string; name: string; msgs: number; spend: number; cpm: string }> = (() => {
                if (!selectedColumns.includes("cost_per_message")) return [];
                return adsets
                  .filter(a => a.status === "ACTIVE")
                  .map(a => {
                    const msgAction = a.actions?.find(x => x.action_type === "onsite_conversion.messaging_conversation_started_7d");
                    const msgs = parseInt(msgAction?.value ?? "0", 10);
                    const spend = parseFloat(a.spend ?? "0");
                    return { id: a.id, name: a.name, msgs, spend, cpm: a.cpm };
                  })
                  .filter(a => a.msgs > 0)
                  .sort((a, b) => (a.spend / a.msgs) - (b.spend / b.msgs)); // ordena do mais barato
              })();

              return (
                <section>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-3">

                    {/* Hero — Investimento (sempre visível, col-span-4) */}
                    <div className="col-span-2 sm:col-span-3 lg:col-span-4 relative rounded-2xl p-4 sm:p-5 overflow-hidden
                      bg-[#0B0F0D]/80 backdrop-blur-md border border-[#39FF14]/25
                      shadow-[0_0_20px_rgba(57,255,20,0.08),inset_0_1px_0_rgba(57,255,20,0.1)]
                      hover:shadow-[0_8px_40px_rgba(57,255,20,0.18)] hover:-translate-y-0.5 hover:scale-[1.01]
                      transition-all duration-200 ease-out group cursor-default">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#39FF14]/[0.05] via-transparent to-transparent pointer-events-none" />
                      <div className="absolute top-3 right-3 flex flex-col items-center">
                        {[3,2,1].map((layer) => (
                          <div key={layer} className="w-12 h-3 rounded-sm"
                            style={{
                              marginTop: layer === 3 ? 0 : -6,
                              background: layer === 1
                                ? "linear-gradient(180deg,#39FF14 0%,#2bcc10 50%,#1a8a0a 100%)"
                                : layer === 2
                                ? "linear-gradient(180deg,#2bcc10 0%,#1F7A3A 100%)"
                                : "linear-gradient(180deg,#1F7A3A 0%,#0f4a1e 100%)",
                              boxShadow: layer === 1
                                ? "0 0 12px rgba(57,255,20,0.4), 0 2px 4px rgba(0,0,0,0.5)"
                                : "0 1px 3px rgba(0,0,0,0.5)",
                              transform: `perspective(100px) rotateX(${layer * 8}deg) translateZ(${layer * 1}px)`,
                              zIndex: layer,
                            }}
                          />
                        ))}
                      </div>
                      <div className="relative">
                        <p className="text-[10px] uppercase tracking-widest text-[#A0A0A0] font-semibold mb-1">Investimento</p>
                        <p className="text-2xl sm:text-3xl font-black font-mono text-white"
                          style={{ textShadow: "0 0 16px rgba(57,255,20,0.2)" }}>
                          {fmtCurrency(ov?.spend ?? 0)}
                        </p>
                        <div className="mt-2 pt-2 border-t border-[#39FF14]/10">
                          <p className="text-[10px] text-[#666] uppercase tracking-wider">Valor de Conversão</p>
                          <p className="text-base font-bold font-mono text-[#39FF14]">{fmtCurrency(ov?.purchaseValue ?? 0)}</p>
                        </div>
                        {cmp?.spend != null && (
                          <div className="flex items-center gap-1 mt-1">
                            {cmp.spend >= 0 ? <ArrowUp size={10} className="text-[#39FF14]" /> : <ArrowDown size={10} className="text-rose-400" />}
                            <span className={`text-[10px] font-mono font-semibold ${cmp.spend >= 0 ? "text-[#39FF14]" : "text-rose-400"}`}>{Math.abs(cmp.spend).toFixed(1)}%</span>
                            <span className="text-[#444] text-[9px]">vs anterior</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cards dinâmicos — cada coluna ativa */}
                    {activeKpis.map((kpi) => {
                      const Icon = kpi.icon;
                      const alertBg = kpi.alert === "positive"
                        ? "bg-[#39FF14]/[0.05] border-[#39FF14]/25"
                        : kpi.alert === "negative"
                        ? "bg-rose-500/[0.04] border-rose-500/20"
                        : "bg-[#0B0F0D]/60 border-[#39FF14]/12";
                      const alertText = kpi.alert === "positive"
                        ? "text-[#39FF14]"
                        : kpi.alert === "negative"
                        ? "text-rose-400"
                        : "text-white";

                      // cost_per_message: expande em cards individuais por adset
                      if (kpi.id === "cost_per_message" && adsetMsgCards.length > 0) {
                        return (
                          <React.Fragment key={kpi.id}>
                            {adsetMsgCards.map((a, idx) => {
                              const cpm = a.spend / a.msgs;
                              // Cor por performance: verde < R$5, amarelo < R$10, vermelho > R$10
                              const perfColor = cpm <= 5 ? "text-[#39FF14]" : cpm <= 10 ? "text-amber-400" : "text-rose-400";
                              const perfBg = cpm <= 5 ? "bg-[#39FF14]/[0.05] border-[#39FF14]/25" : cpm <= 10 ? "bg-amber-500/[0.04] border-amber-500/20" : "bg-rose-500/[0.04] border-rose-500/20";
                              // Nome curto: remove prefixos de nomenclatura tipo [19.03][CP00]
                              const shortName = a.name.replace(/^\[[\w.\s-]+\]/g, "").trim() || a.name;
                              return (
                                <div key={a.id} className={`lg:col-span-2 rounded-xl p-3 sm:p-4 backdrop-blur-sm border hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(57,255,20,0.1)] transition-all duration-200 cursor-default flex flex-col gap-2 ${perfBg}`}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-[#39FF14]/10 flex items-center justify-center shrink-0">
                                      <MessageCircle size={14} className="text-[#39FF14]" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[9px] uppercase tracking-wider text-[#555] font-semibold leading-tight">Custo/Msg</p>
                                      <p className="text-[10px] text-[#777] leading-tight truncate max-w-[100px]" title={a.name}>{shortName}</p>
                                    </div>
                                    {idx === 0 && adsetMsgCards.length > 1 && (
                                      <span className="ml-auto text-[8px] bg-[#39FF14]/10 text-[#39FF14] px-1.5 py-0.5 rounded font-bold shrink-0">MELHOR</span>
                                    )}
                                  </div>
                                  <div className="flex items-end justify-between gap-1">
                                    <p className={`text-xl sm:text-2xl font-black font-mono leading-none ${perfColor}`}>
                                      {fmtCurrency(cpm)}
                                    </p>
                                    <p className="text-[9px] text-[#444] font-mono leading-tight text-right">
                                      {fmtInt(a.msgs)} msg<br/>
                                      {fmtCurrency(a.spend)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </React.Fragment>
                        );
                      }

                      return (
                        <div key={kpi.id} className={`lg:col-span-2 rounded-xl p-3 sm:p-4 backdrop-blur-sm
                          border hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(57,255,20,0.1)]
                          transition-all duration-200 cursor-default flex flex-col gap-2 ${alertBg}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#39FF14]/10 flex items-center justify-center shrink-0">
                              <Icon size={14} className="text-[#39FF14]" />
                            </div>
                            <p className="text-[10px] uppercase tracking-wider text-[#888] font-semibold leading-tight">{kpi.label}</p>
                          </div>
                          <p className={`text-xl sm:text-2xl font-black font-mono leading-none ${alertText}`}
                            style={kpi.alert === "positive" ? { textShadow: "0 0 10px rgba(57,255,20,0.3)" } : undefined}>
                            {kpi.value}
                          </p>
                        </div>
                      );
                    })}

                    {/* Fallback se nenhuma coluna extra selecionada — mostra Compras + CPM estáticos */}
                    {activeKpis.length === 0 && (
                      <>
                        {[
                          { id: "purchases", label: "Compras", value: fmtInt(ov?.purchases ?? 0), Icon: ShoppingCart, alert: null as "positive"|"negative"|null },
                          { id: "cpm", label: "CPM", value: fmtCurrency(ov?.cpm ?? 0), Icon: BarChart3, alert: cpmAlert },
                          { id: "cpp", label: "Custo/Resultado", value: cpaVal !== null ? fmtCurrency(cpaVal) : "N/A", Icon: TrendingDown, alert: null as "positive"|"negative"|null },
                          { id: "roas", label: "ROAS", value: roasVal !== null ? `${fmt(roasVal, 2)}x` : "N/A", Icon: Zap, alert: roasAlert },
                          { id: "ctr", label: "CTR", value: `${fmt(ov?.ctr ?? 0, 2)}%`, Icon: Activity, alert: ctrAlert },
                        ].map((m) => {
                          const alertBg = m.alert === "positive" ? "bg-[#39FF14]/[0.05] border-[#39FF14]/25" : m.alert === "negative" ? "bg-rose-500/[0.04] border-rose-500/20" : "bg-[#0B0F0D]/60 border-[#39FF14]/12";
                          const alertText = m.alert === "positive" ? "text-[#39FF14]" : m.alert === "negative" ? "text-rose-400" : "text-white";
                          return (
                            <div key={m.id} className={`lg:col-span-2 rounded-xl p-3 sm:p-4 backdrop-blur-sm border hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(57,255,20,0.1)] transition-all duration-200 cursor-default flex flex-col gap-2 ${alertBg}`}>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-[#39FF14]/10 flex items-center justify-center shrink-0">
                                  <m.Icon size={14} className="text-[#39FF14]" />
                                </div>
                                <p className="text-[10px] uppercase tracking-wider text-[#888] font-semibold leading-tight">{m.label}</p>
                              </div>
                              <p className={`text-xl sm:text-2xl font-black font-mono leading-none ${alertText}`}
                                style={m.alert === "positive" ? { textShadow: "0 0 10px rgba(57,255,20,0.3)" } : undefined}>
                                {m.value}
                              </p>
                            </div>
                          );
                        })}
                      </>
                    )}

                  </div>
                </section>
              );
            })()}

            {/* ── TAB: Visão Geral ── */}
            {activeTab === "overview" && (
              <>
                {/* ═══ SEÇÃO: POR TIPO DE CAMPANHA ═══ */}
                {campaigns.length > 0 && (() => {
                  // Helper functions
                  const sumAction = (cams: CampaignRow[], actionType: string): number =>
                    cams.reduce((acc, c) => {
                      const a = c.actions?.find(x => x.action_type === actionType);
                      return acc + (a ? parseInt(a.value, 10) : 0);
                    }, 0);
                  const sumActionValue = (cams: CampaignRow[], actionType: string): number =>
                    cams.reduce((acc, c) => {
                      const a = c.action_values?.find(x => x.action_type === actionType);
                      return acc + (a ? parseFloat(a.value) : 0);
                    }, 0);

                  // Group campaigns by objective
                  const groups = campaigns.reduce<Record<string, CampaignRow[]>>((acc, c) => {
                    const key = c.objective || "UNKNOWN";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(c);
                    return acc;
                  }, {});
                  const groupEntries = Object.entries(groups);
                  const isSingle = groupEntries.length === 1;

                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Target size={13} className="text-[#39FF14]" />
                        <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">Por Tipo de Campanha</p>
                      </div>
                      <div className={`${isSingle ? "" : "flex gap-3 overflow-x-auto pb-1"}`}>
                        {groupEntries.map(([objective, cams]) => {
                          const objInfo = OBJECTIVE_MAP[objective];
                          const ObjIcon = objInfo?.icon ?? Target;
                          // Compute metrics for this group
                          const totalSpend = cams.reduce((s, c) => s + parseFloat(c.spend || "0"), 0);
                          const avgCtr = cams.length > 0 ? cams.reduce((s, c) => s + parseFloat(c.ctr || "0"), 0) / cams.length : 0;
                          const avgCpm = cams.length > 0 ? cams.reduce((s, c) => s + parseFloat(c.cpm || "0"), 0) / cams.length : 0;
                          const totalReach = cams.reduce((s, c) => s + parseFloat(c.reach || "0"), 0);
                          const totalClicks = cams.reduce((s, c) => s + parseFloat(c.clicks || "0"), 0);
                          const grpPurchases = sumAction(cams, "offsite_conversion.fb_pixel_purchase") || sumAction(cams, "purchase") || sumAction(cams, "omni_purchase");
                          const grpRevenue = sumActionValue(cams, "offsite_conversion.fb_pixel_purchase") || sumActionValue(cams, "purchase");
                          const grpLeads = sumAction(cams, "lead") || sumAction(cams, "offsite_conversion.fb_pixel_lead");
                          const grpMsgs = sumAction(cams, "onsite_conversion.messaging_conversation_started_7d");
                          const grpVideoViews = sumAction(cams, "video_view");
                          const grpAddCart = sumAction(cams, "offsite_conversion.fb_pixel_add_to_cart") || sumAction(cams, "add_to_cart");
                          const grpCheckout = sumAction(cams, "offsite_conversion.fb_pixel_initiate_checkout") || sumAction(cams, "initiate_checkout");
                          const grpRoas = grpRevenue > 0 && totalSpend > 0 ? grpRevenue / totalSpend : null;

                          // Build visible metrics from selectedColumns
                          type GroupMetric = { label: string; value: string };
                          const metrics: GroupMetric[] = [];
                          if (selectedColumns.includes("spend")) metrics.push({ label: "Investimento", value: fmtCurrency(totalSpend) });
                          if (selectedColumns.includes("ctr")) metrics.push({ label: "CTR", value: `${fmt(avgCtr, 2)}%` });
                          if (selectedColumns.includes("cpm")) metrics.push({ label: "CPM", value: fmtCurrency(avgCpm) });
                          if (selectedColumns.includes("reach")) metrics.push({ label: "Alcance", value: fmtInt(totalReach) });
                          if (selectedColumns.includes("clicks")) metrics.push({ label: "Cliques", value: fmtInt(totalClicks) });
                          if (selectedColumns.includes("roas") && grpRoas !== null) metrics.push({ label: "ROAS", value: `${fmt(grpRoas, 2)}x` });
                          if (selectedColumns.includes("purchases") && grpPurchases > 0) metrics.push({ label: "Compras", value: fmtInt(grpPurchases) });
                          if (selectedColumns.includes("revenue") && grpRevenue > 0) metrics.push({ label: "Receita", value: fmtCurrency(grpRevenue) });
                          if (selectedColumns.includes("cpp") && grpPurchases > 0) metrics.push({ label: "CPA", value: fmtCurrency(totalSpend / grpPurchases) });
                          if (selectedColumns.includes("leads") && grpLeads > 0) metrics.push({ label: "Leads", value: fmtInt(grpLeads) });
                          if (selectedColumns.includes("cost_per_lead") && grpLeads > 0) metrics.push({ label: "Custo/Lead", value: fmtCurrency(totalSpend / grpLeads) });
                          if (selectedColumns.includes("messages") && grpMsgs > 0) metrics.push({ label: "Mensagens", value: fmtInt(grpMsgs) });
                          if (selectedColumns.includes("cost_per_message") && grpMsgs > 0) metrics.push({ label: "Custo/Msg", value: fmtCurrency(totalSpend / grpMsgs) });
                          if (selectedColumns.includes("video_views") && grpVideoViews > 0) metrics.push({ label: "Views Vídeo", value: fmtInt(grpVideoViews) });
                          if (selectedColumns.includes("add_to_cart") && grpAddCart > 0) metrics.push({ label: "Add Carrinho", value: fmtInt(grpAddCart) });
                          if (selectedColumns.includes("initiate_checkout") && grpCheckout > 0) metrics.push({ label: "Checkout", value: fmtInt(grpCheckout) });

                          const accentColor = objInfo?.color ?? "text-[#39FF14] bg-[#39FF14]/10 border-[#39FF14]/20";
                          const borderAccent = accentColor.includes("blue") ? "border-blue-500/20 hover:border-blue-500/40"
                            : accentColor.includes("purple") ? "border-purple-500/20 hover:border-purple-500/40"
                            : accentColor.includes("cyan") ? "border-cyan-500/20 hover:border-cyan-500/40"
                            : accentColor.includes("teal") ? "border-teal-500/20 hover:border-teal-500/40"
                            : accentColor.includes("orange") ? "border-orange-500/20 hover:border-orange-500/40"
                            : accentColor.includes("emerald") ? "border-emerald-500/20 hover:border-emerald-500/40"
                            : "border-[#39FF14]/15 hover:border-[#39FF14]/35";

                          return (
                            <div key={objective}
                              onClick={() => { setActiveTab("campaigns"); setCampaignFilter(objective); }}
                              className={`group ${isSingle ? "w-full" : "w-full sm:min-w-[220px] sm:flex-shrink-0"}
                                rounded-xl p-4 bg-[#0B0F0D]/70 backdrop-blur-sm border
                                ${borderAccent}
                                hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(57,255,20,0.08)]
                                transition-all duration-200 cursor-pointer`}>
                              {/* Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-semibold ${accentColor}`}>
                                  <ObjIcon size={11} />
                                  <span>{objInfo?.label ?? objective}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[#444] text-[10px] font-mono">{cams.length} camp.</span>
                                  <ChevronRight size={10} className="text-[#333] group-hover:text-[#39FF14] transition-colors" />
                                </div>
                              </div>
                              {/* Metrics */}
                              <div className="space-y-1.5">
                                {metrics.slice(0, 6).map((m) => (
                                  <div key={m.label} className="flex items-center justify-between">
                                    <span className="text-[#555] text-[10px]">{m.label}</span>
                                    <span className="text-white text-[11px] font-mono font-bold">{m.value}</span>
                                  </div>
                                ))}
                                {metrics.length === 0 && (
                                  <p className="text-[#333] text-[10px] font-mono">Sem métricas selecionadas</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* ── GRID PRINCIPAL: 3 colunas ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

                  {/* ═══ COLUNA 1 — Retorno (gráfico de linha) ═══ */}
                  <div className="lg:col-span-4">
                    <div className="rounded-2xl p-4 sm:p-5 bg-[#0B0F0D]/70 backdrop-blur-md border border-[#39FF14]/15
                      shadow-[0_0_15px_rgba(57,255,20,0.06)] hover:shadow-[0_8px_30px_rgba(57,255,20,0.12)]
                      hover:-translate-y-0.5 transition-all duration-200 h-full flex flex-col">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                            <TrendingUp size={14} className="text-[#39FF14]" />
                          </div>
                          <p className="text-white font-semibold text-sm">Retorno</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-[#39FF14] rounded-full" /><span className="text-[#555]">Valor gasto</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-[#2bcc10] rounded-full" /><span className="text-[#555]">Compras</span></div>
                        </div>
                      </div>
                      {/* Chart */}
                      {chartData.length > 0 ? (
                        <div className="flex-1">
                          <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                              <defs>
                                <linearGradient id="gSpend3D" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#39FF14" stopOpacity={0.35} />
                                  <stop offset="60%" stopColor="#39FF14" stopOpacity={0.08} />
                                  <stop offset="100%" stopColor="#39FF14" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gClicks3D" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#2bcc10" stopOpacity={0.2} />
                                  <stop offset="100%" stopColor="#2bcc10" stopOpacity={0} />
                                </linearGradient>
                                <filter id="neonGlow">
                                  <feGaussianBlur stdDeviation="2" result="blur" />
                                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                              </defs>
                              <CartesianGrid strokeDasharray="2 4" stroke="#0f1a0f" vertical={false} />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#2a3a2a", fontSize: 9 }} interval={Math.max(Math.floor(chartData.length / 4), 1)} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#2a3a2a", fontSize: 9 }} />
                              <Tooltip content={<ChartTooltip />} />
                              <Area type="monotone" dataKey="Gasto" stroke="#39FF14" strokeWidth={2.5} fill="url(#gSpend3D)" dot={false}
                                style={{ filter: "drop-shadow(0 0 4px rgba(57,255,20,0.5))" }} />
                              <Area type="monotone" dataKey="Cliques" stroke="#2bcc10" strokeWidth={1.5} fill="url(#gClicks3D)" dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[#333] text-sm font-mono">Sem dados de série temporal</div>
                      )}
                    </div>
                  </div>

                  {/* ═══ COLUNA 2 — Funil Geral 3D ═══ */}
                  <div className="lg:col-span-4">
                    <div className="rounded-2xl p-4 sm:p-5 bg-[#0B0F0D]/80 backdrop-blur-md border border-[#39FF14]/20
                      shadow-[0_0_20px_rgba(57,255,20,0.08)] h-full flex flex-col">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-4 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#39FF14]/10 flex items-center justify-center">
                            <Layers size={14} className="text-[#39FF14]" />
                          </div>
                          <p className="text-white font-semibold text-sm">Funil Geral</p>
                        </div>
                        {fn && fn.purchase > 0 && fn.impressions > 0 && (
                          <div className="px-2 py-1 bg-[#39FF14]/8 rounded-lg border border-[#39FF14]/20">
                            <span className="text-[#39FF14] text-[10px] font-bold font-mono">CVR {((fn.purchase / fn.impressions) * 100).toFixed(3)}%</span>
                          </div>
                        )}
                      </div>

                      {/* 3D Funnel */}
                      {funnelSteps.length > 0 ? (
                        <div className="flex-1 flex flex-col justify-around py-1 gap-1">
                          {funnelSteps.map((step, i) => {
                            const totalSteps = funnelSteps.length;
                            const next = i < totalSteps - 1 ? funnelSteps[i + 1] : null;
                            const rate = next && step.value > 0 ? ((next.value / step.value) * 100).toFixed(1) : null;
                            const costPerStep = spendVal > 0 && step.value > 0 ? spendVal / step.value : 0;
                            // Trapezoid narrows as we go down — % indent per side
                            const indentPct = (i / Math.max(totalSteps - 1, 1)) * 12;
                            const nextIndentPct = ((i + 1) / Math.max(totalSteps - 1, 1)) * 12;
                            // Color darkens each step
                            const greenStart = Math.max(Math.round(200 - i * (110 / totalSteps)), 80);
                            const greenEnd = Math.max(Math.round(150 - i * (80 / totalSteps)), 40);
                            const barHeight = Math.max(44 - i * 3, 32);
                            return (
                              <div key={step.label} className="w-full flex flex-col">
                                {/* Row: label | bar | value */}
                                <div className="flex items-center gap-2 w-full">
                                  {/* Label — outside the clip, fixed width */}
                                  <span className="text-[#888] text-[9px] font-semibold uppercase tracking-wide shrink-0 w-[70px] text-right leading-tight">
                                    {step.label}
                                  </span>
                                  {/* Trapezoid bar — clip only applies here */}
                                  <div className="relative flex-1" style={{ height: `${barHeight}px` }}>
                                    <div className="absolute inset-0 transition-all duration-200 hover:brightness-110 cursor-default"
                                      style={{
                                        clipPath: `polygon(${indentPct}% 0%, ${100 - indentPct}% 0%, ${100 - nextIndentPct}% 100%, ${nextIndentPct}% 100%)`,
                                        background: `linear-gradient(180deg, rgb(${greenStart},255,20) 0%, rgba(31,${greenEnd},20,0.92) 100%)`,
                                        filter: `drop-shadow(0 2px 6px rgba(57,255,20,${Math.max(0.28 - i * 0.04, 0.06)}))`,
                                      }}>
                                      {/* Top highlight shimmer */}
                                      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                                    </div>
                                  </div>
                                  {/* Value — outside the clip */}
                                  <span className="text-white font-black text-xs font-mono shrink-0 w-[52px] text-left tabular-nums">
                                    {step.value >= 1000
                                      ? step.value >= 1_000_000
                                        ? `${(step.value / 1_000_000).toFixed(1)}M`
                                        : `${(step.value / 1000).toFixed(1)}k`
                                      : step.value.toLocaleString("pt-BR")}
                                  </span>
                                </div>
                                {/* Drop-off rate below the bar */}
                                {rate !== null && (
                                  <div className="flex items-center gap-1.5 ml-[78px] mt-0.5 mb-0.5">
                                    <span className={`text-[9px] font-mono font-bold ${parseFloat(rate) < 10 ? "text-rose-400" : "text-[#39FF14]"}`}>
                                      ↓ {rate}%
                                    </span>
                                    {costPerStep > 0 && (
                                      <span className="text-[#444] text-[9px] font-mono">{fmtCurrency(costPerStep)}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-[#333] text-sm font-mono">Sem dados de conversão</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ═══ COLUNA 3 — Demográficos + Funil de Vídeo ═══ */}
                  <div className="lg:col-span-4 flex flex-col gap-4">

                    {/* Demográficos — Donut com legenda lateral e DAP central */}
                    <div className="rounded-2xl p-4 sm:p-5 bg-[#0B0F0D]/70 backdrop-blur-md border border-[#39FF14]/15
                      hover:shadow-[0_8px_30px_rgba(57,255,20,0.1)] hover:-translate-y-0.5 transition-all duration-200 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={13} className="text-[#39FF14]" />
                        <p className="text-[10px] text-[#666] uppercase tracking-widest font-semibold">Demográficos</p>
                      </div>
                      {ageDonutData.length > 0 ? (
                        <div className="flex items-center gap-3">
                          {/* Donut with DAP label */}
                          <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
                            <ResponsiveContainer width={130} height={130}>
                              <PieChart>
                                <Pie data={ageDonutData} cx="50%" cy="50%" innerRadius={38} outerRadius={56}
                                  paddingAngle={2} dataKey="value" stroke="none"
                                  style={{ filter: "drop-shadow(0 0 6px rgba(57,255,20,0.2))" }}>
                                  {ageDonutData.map((e) => <Cell key={e.name} fill={e.color} />)}
                                </Pie>
                                <Tooltip content={<DonutTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-sm font-black tracking-widest text-white"
                                style={{ textShadow: "0 0 12px rgba(57,255,20,0.4)" }}>DAP</span>
                            </div>
                          </div>
                          {/* Legend side */}
                          <div className="flex-1 space-y-1.5">
                            {ageDonutData.map((d) => (
                              <div key={d.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                                  <span className="text-[#666] text-[10px]">{d.name}</span>
                                </div>
                                <span className="text-[#A0A0A0] text-[10px] font-bold font-mono">{d.value}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-24 flex items-center justify-center text-[#333] text-xs font-mono">Sem dados</div>
                      )}
                    </div>

                    {/* Funil de Vídeo — 4 botões neon */}
                    <div className="rounded-2xl p-4 sm:p-5 bg-[#0B0F0D]/70 backdrop-blur-md border border-[#39FF14]/15
                      hover:shadow-[0_8px_30px_rgba(57,255,20,0.1)] hover:-translate-y-0.5 transition-all duration-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Video size={13} className="text-[#39FF14]" />
                        <p className="text-[10px] text-[#666] uppercase tracking-widest font-semibold">Funil de Vídeo</p>
                      </div>
                      {videoRetentionItems.length > 0 && vr && (vr.p25 > 0 || vr.p50 > 0) ? (
                        <div className="grid grid-cols-4 gap-2">
                          {videoRetentionItems.map((item) => (
                            <div key={item.label} className="flex flex-col items-center gap-1.5">
                              <div
                                className="w-full text-center py-2 rounded-lg text-black font-black text-[10px] cursor-default
                                  hover:scale-105 hover:shadow-[0_0_12px_rgba(57,255,20,0.5)] transition-all duration-200"
                                style={{
                                  background: "linear-gradient(180deg,#39FF14 0%,#2bcc10 100%)",
                                  boxShadow: "0 2px 8px rgba(57,255,20,0.25), inset 0 1px 0 rgba(255,255,255,0.3)",
                                }}>
                                {item.label}
                              </div>
                              <span className="text-[#39FF14] text-[11px] font-mono font-bold">{item.value}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-16 flex items-center justify-center text-[#333] text-xs font-mono">Sem dados de vídeo</div>
                      )}
                    </div>

                    {/* Insights Rápidos — baseados em selectedColumns */}
                    {ov && (() => {
                      type Insight = { type: "warning" | "positive" | "info"; msg: string };
                      const il: Insight[] = [];
                      const ctrN = parseFloat(ov.ctr);
                      const cpmN = parseFloat(ov.cpm);
                      const roasN = ov.roas;
                      const freqAvg = campaigns.length > 0
                        ? campaigns.reduce((s, c) => s + parseFloat(c.frequency ?? "0"), 0) / campaigns.length : 0;

                      // ROAS insight — se coluna ativa
                      if (selectedColumns.includes("roas")) {
                        if (roasN !== null && roasN >= 3) il.push({ type: "positive", msg: `ROAS excelente (${fmt(roasN, 2)}x) — retorno acima de 3x.` });
                        else if (roasN !== null && roasN < 1) il.push({ type: "warning", msg: `ROAS abaixo de 1x (${fmt(roasN, 2)}x) — campanhas consumindo mais do que geram.` });
                        else if (roasN !== null) il.push({ type: "info", msg: `ROAS ${fmt(roasN, 2)}x — dentro da faixa operacional.` });
                      }
                      // CTR insight
                      if (selectedColumns.includes("ctr")) {
                        if (ctrN < 1) il.push({ type: "warning", msg: `CTR baixo (${fmt(ctrN, 2)}%) — revisar criativos e segmentação.` });
                        else if (ctrN >= 3) il.push({ type: "positive", msg: `CTR excepcional (${fmt(ctrN, 2)}%).` });
                      }
                      // CPM insight
                      if (selectedColumns.includes("cpm") && cpmN > 80) {
                        il.push({ type: "warning", msg: `CPM alto (${fmtCurrency(cpmN)}) — considere refinar o público.` });
                      }
                      // Mensagens insight
                      if (selectedColumns.includes("messages")) {
                        const msgs = campaigns.reduce((acc, c) => {
                          const a = c.actions?.find(x => x.action_type === "onsite_conversion.messaging_conversation_started_7d");
                          return acc + (a ? parseInt(a.value, 10) : 0);
                        }, 0);
                        if (msgs > 0) il.push({ type: "info", msg: `${fmtInt(msgs)} conversas iniciadas via mensagem.` });
                      }
                      // Leads insight
                      if (selectedColumns.includes("leads")) {
                        const leads = campaigns.reduce((acc, c) => {
                          const a = c.actions?.find(x => x.action_type === "lead" || x.action_type === "offsite_conversion.fb_pixel_lead");
                          return acc + (a ? parseInt(a.value, 10) : 0);
                        }, 0);
                        if (leads > 0) il.push({ type: "info", msg: `${fmtInt(leads)} leads gerados no período.` });
                      }
                      // Video views insight
                      if (selectedColumns.includes("video_views")) {
                        const vv = campaigns.reduce((acc, c) => {
                          const a = c.actions?.find(x => x.action_type === "video_view");
                          return acc + (a ? parseInt(a.value, 10) : 0);
                        }, 0);
                        if (vv > 0) il.push({ type: "info", msg: `${fmtInt(vv)} views de vídeo — verifique retenção no funil de vídeo.` });
                      }
                      // Frequency (always if campaigns exist)
                      if (freqAvg > 3.5) il.push({ type: "warning", msg: `Frequência alta (${fmt(freqAvg, 1)}x). Risco de fadiga criativa.` });

                      // Fallbacks if no columns selected produce insights
                      if (il.length === 0) {
                        if (roasN !== null && roasN >= 4) il.push({ type: "positive", msg: `ROAS excelente (${fmt(roasN, 2)}x). Escalar budget.` });
                        else if (roasN !== null && roasN < 1) il.push({ type: "warning", msg: `ROAS abaixo do break-even (${fmt(roasN, 2)}x).` });
                        if (ctrN < 1) il.push({ type: "warning", msg: `CTR crítico (${fmt(ctrN, 2)}%). Testar criativos.` });
                        if (il.length === 0) il.push({ type: "info", msg: "Métricas dentro dos parâmetros normais." });
                      }

                      return (
                        <div className="rounded-2xl p-4 bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#39FF14]/10">
                          <div className="flex items-center gap-2 mb-2.5">
                            <Bell size={12} className="text-[#39FF14]" />
                            <p className="text-[10px] text-[#555] uppercase tracking-widest font-semibold">Insights Automáticos</p>
                          </div>
                          <div className="space-y-1.5">
                            {il.slice(0, 5).map((ins, idx) => (
                              <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg border text-[10px] leading-relaxed ${
                                ins.type === "warning" ? "bg-rose-500/[0.05] border-rose-500/15 text-rose-400"
                                : ins.type === "positive" ? "bg-[#39FF14]/[0.05] border-[#39FF14]/15 text-[#39FF14]"
                                : "bg-white/[0.02] border-[#111] text-[#555]"}`}>
                                <span className="shrink-0 mt-0.5">
                                  {ins.type === "warning" ? <AlertTriangle size={10} /> : ins.type === "positive" ? <CheckCircle2 size={10} /> : <Info size={10} />}
                                </span>
                                <span>{ins.msg}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ── LINHA INFERIOR — Linha do Tempo + Criativos Destaques ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                  {/* Linha do Tempo — tabela de campanhas */}
                  <div className="lg:col-span-7 rounded-2xl bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#39FF14]/10 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#39FF14]/8">
                      <div className="flex items-center gap-2">
                        <Activity size={13} className="text-[#39FF14]" />
                        <p className="text-[11px] text-white font-semibold">Linha do Tempo</p>
                      </div>
                      <button onClick={() => setActiveTab("campaigns")} className="text-[10px] text-[#444] hover:text-[#39FF14] transition-colors cursor-pointer">Ver todas →</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-[#0f1a0f]">
                            {["Campanha", "Mensagens Link.", "CTR (link)", "Quality Rank", "Clicks na Link", "Qualidade"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left text-[#444] font-semibold uppercase tracking-wider whitespace-nowrap text-[10px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0a120a]">
                          {campaigns.slice(0, 5).map((c) => {
                            const cCtr = parseFloat(c.ctr ?? "0");
                            const cClicks = parseInt(c.clicks ?? "0", 10);
                            const cImpressions = parseInt(c.impressions ?? "0", 10);
                            const qualityRank = cCtr >= 3 ? "Acima Média" : cCtr >= 1 ? "Média" : "Abaixo";
                            const qualityColor = cCtr >= 3 ? "text-[#39FF14]" : cCtr >= 1 ? "text-amber-400" : "text-rose-400";
                            return (
                              <tr key={c.id}
                                onClick={() => openCampaign(c.id, c.objective)}
                                className="hover:bg-[#39FF14]/[0.04] cursor-pointer transition-colors group/camp">
                                <td className="px-3 py-2.5 max-w-[120px]">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[#A0A0A0] group-hover/camp:text-white truncate block transition-colors">{c.name}</span>
                                    <ChevronRight size={9} className="text-[#333] group-hover/camp:text-[#39FF14] shrink-0 transition-colors" />
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-white font-mono">{fmtInt(cImpressions)}</td>
                                <td className={`px-3 py-2.5 font-mono font-bold ${cCtr >= 3 ? "text-[#39FF14]" : cCtr < 1 ? "text-rose-400" : "text-amber-400"}`}>{fmt(c.ctr, 2)}%</td>
                                <td className={`px-3 py-2.5 font-semibold ${qualityColor}`}>{qualityRank}</td>
                                <td className="px-3 py-2.5 text-white font-mono">{fmtInt(cClicks)}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                    cCtr >= 3 ? "bg-[#39FF14]/10 text-[#39FF14]" : cCtr < 1 ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                                  }`}>{fmtCurrency(c.spend)}</span>
                                </td>
                              </tr>
                            );
                          })}
                          {campaigns.length === 0 && (
                            <tr><td colSpan={6} className="px-3 py-8 text-center text-[#333] font-mono">Sem campanhas</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Criativos Destaques */}
                  <div className="lg:col-span-5 rounded-2xl bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#39FF14]/10 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#39FF14]/8">
                      <div className="flex items-center gap-2">
                        <Image size={13} className="text-[#39FF14]" />
                        <p className="text-[11px] text-white font-semibold">Criativos Destaques</p>
                      </div>
                      <button onClick={() => setActiveTab("creatives")} className="text-[10px] text-[#444] hover:text-[#39FF14] transition-colors cursor-pointer">Ver ranking →</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-[#0f1a0f]">
                            {["Alcance/Mensagens", "Custo/Mensagem", "CTR (mensagem)", "Taxa de Clique"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left text-[#444] font-semibold uppercase tracking-wider whitespace-nowrap text-[10px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#0a120a]">
                          {creatives.slice(0, 5).map((cr) => {
                            const crCtr = parseFloat(cr.ctr ?? "0");
                            const crCpm = parseFloat((cr as any).cpm ?? cr.cpc ?? "0");
                            const crSpend = parseFloat(cr.spend ?? "0");
                            return (
                              <tr key={cr.id} className="hover:bg-[#39FF14]/[0.02] transition-colors">
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    {cr.thumbnail_url ? (
                                      <img src={cr.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover opacity-80 shrink-0" />
                                    ) : (
                                      <div className="w-8 h-8 rounded bg-[#111] flex items-center justify-center shrink-0">
                                        <Image size={12} className="text-[#333]" />
                                      </div>
                                    )}
                                    <span className="text-[#A0A0A0] truncate max-w-[80px] block">{cr.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-[#39FF14] font-mono font-bold">{fmtCurrency(crSpend)}</td>
                                <td className={`px-3 py-2.5 font-mono font-bold ${crCtr >= 3 ? "text-[#39FF14]" : crCtr < 1 ? "text-rose-400" : "text-amber-400"}`}>{fmt(cr.ctr, 2)}%</td>
                                <td className="px-3 py-2.5 text-[#A0A0A0] font-mono">{fmtCurrency(crCpm)}</td>
                              </tr>
                            );
                          })}
                          {creatives.length === 0 && (
                            <tr><td colSpan={4} className="px-3 py-8 text-center text-[#333] font-mono">Sem criativos</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── TAB: Campanhas ── */}
            {activeTab === "campaigns" && (() => {
              const objectives = Array.from(new Set(campaigns.map((c) => c.objective).filter(Boolean)));
              const filteredCampaigns = campaignFilter === "all" ? campaigns : campaigns.filter((c) => c.objective === campaignFilter);
              const visibleCols = ALL_COLUMNS.filter((c) => selectedColumns.includes(c.id));
              // Expanded campaign state (inline detail panel)
              const toggleExpand = (id: string) => setExpandedCampaignId(prev => prev === id ? null : id);

              return (
                <>
                  {showColumnEditor && (
                    <ColumnEditor selected={selectedColumns} onChange={saveColumns} onClose={() => setShowColumnEditor(false)} />
                  )}
                  {healthPanel && (
                    <CampaignHealthPanel campaign={healthPanel} onClose={() => setHealthPanel(null)} />
                  )}

                  {/* Highlight banner — shown when navigated from overview */}
                  {highlightedCampaignId && (() => {
                    const hc = campaigns.find(c => c.id === highlightedCampaignId);
                    if (!hc) return null;
                    return (
                      <div className="flex items-center justify-between px-4 py-2.5 mb-3 rounded-xl bg-[#39FF14]/[0.06] border border-[#39FF14]/20 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14] animate-pulse" />
                          <span className="text-[11px] text-[#39FF14] font-semibold">Campanha selecionada:</span>
                          <span className="text-[11px] text-white font-mono truncate max-w-[300px]">{hc.name}</span>
                        </div>
                        <button onClick={() => setHighlightedCampaignId(null)}
                          className="text-[#444] hover:text-[#39FF14] transition-colors cursor-pointer p-1">
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })()}

                  {/* Health score summary cards */}
                  {filteredCampaigns.length > 0 && (() => {
                    const reports = filteredCampaigns.map((c) => ({ c, r: calcHealthScore(c) }));
                    const healthy = reports.filter((x) => x.r.status === "good" || x.r.status === "excellent").length;
                    const warning = reports.filter((x) => x.r.status === "warning").length;
                    const critical = reports.filter((x) => x.r.status === "critical").length;
                    const avgScore = Math.round(reports.reduce((s, x) => s + x.r.score, 0) / reports.length);
                    const avgStatus: HealthStatus = avgScore >= 65 ? "good" : avgScore >= 40 ? "warning" : "critical";
                    const avgColor = avgStatus === "good" ? "text-[#39FF14]" : avgStatus === "warning" ? "text-amber-400" : "text-rose-400";
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {[
                          { label: "Score Médio", value: `${avgScore}`, sub: "de 100", color: avgColor, icon: HeartPulse },
                          { label: "Saudáveis", value: String(healthy), sub: "campanhas", color: "text-[#39FF14]", icon: CheckCircle2 },
                          { label: "Atenção", value: String(warning), sub: "campanhas", color: "text-amber-400", icon: AlertTriangle },
                          { label: "Críticas", value: String(critical), sub: "campanhas", color: "text-rose-400", icon: XCircle },
                        ].map(({ label, value, sub, color, icon: Icon }) => (
                          <div key={label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-[#111] border border-[#1a1a1a]`}>
                              <Icon size={14} className={color} />
                            </div>
                            <div>
                              <p className={`text-lg font-black font-mono leading-none ${color}`}>{value}</p>
                              <p className="text-gray-600 text-[10px] mt-0.5">{label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <SectionCard title="Campanhas" subtitle={`${filteredCampaigns.length} de ${campaigns.length} campanhas`} icon={Table2}
                    action={
                      <div className="flex items-center gap-2">
                        <button onClick={() => setShowColumnEditor(true)}
                          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#39FF14] bg-[#111] border border-[#1a1a1a] px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                          <Columns3 size={12} />Colunas
                          {!columnsSynced && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" title="Sincronizando..." />}
                        </button>
                        <button onClick={() => exportCSV(filteredCampaigns.map(c => {
                          const report = calcHealthScore(c);
                          const row: Record<string, any> = { Nome: c.name, Tipo: OBJECTIVE_MAP[c.objective]?.label ?? c.objective, Status: c.status, "Score Saúde": report.score, "Grau": report.grade };
                          visibleCols.forEach((col) => { row[col.label] = col.getValue(c); });
                          return row;
                        }), "campanhas")}
                          className="flex items-center gap-1.5 text-xs text-[#39FF14] bg-[#39FF14]/10 px-3 py-1.5 rounded-lg cursor-pointer">
                          <Download size={12} />CSV
                        </button>
                      </div>
                    }
                  >
                    {/* Filtro por tipo */}
                    {objectives.length > 1 && (
                      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-[#111] overflow-x-auto">
                        <button onClick={() => setCampaignFilter("all")}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${campaignFilter === "all" ? "bg-[#39FF14]/15 text-[#39FF14]" : "text-gray-500 hover:text-gray-300"}`}>
                          Todas
                        </button>
                        {objectives.map((obj) => {
                          const info = OBJECTIVE_MAP[obj];
                          const Icon = info?.icon ?? Megaphone;
                          return (
                            <button key={obj} onClick={() => setCampaignFilter(obj)}
                              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap cursor-pointer ${campaignFilter === obj ? "bg-[#39FF14]/15 text-[#39FF14]" : "text-gray-500 hover:text-gray-300"}`}>
                              <Icon size={11} />{info?.label ?? obj.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[480px] sm:min-w-[600px]">
                        <thead>
                          <tr className="border-b border-[#1a1a1a]">
                            <th className="text-left text-gray-600 text-xs uppercase px-4 sm:px-6 py-3 font-semibold">Campanha</th>
                            <th className="text-center text-gray-600 text-xs uppercase px-3 py-3 font-semibold whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <HeartPulse size={11} />Saúde
                              </div>
                            </th>
                            {visibleCols.map((col) => (
                              <th key={col.id} className={`${col.align === "right" ? "text-right" : "text-left"} text-gray-600 text-xs uppercase px-3 py-3 font-semibold`}>
                                {col.label}
                              </th>
                            ))}
                            <th className="text-center text-gray-600 text-xs uppercase px-3 py-3 font-semibold w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCampaigns.map((r) => {
                            const report = calcHealthScore(r);
                            const isLoading = actionLoading === r.id;
                            const isHighlighted = r.id === highlightedCampaignId;
                            const isExpanded = expandedCampaignId === r.id;
                            const totalCols = visibleCols.length + 3; // name + health + action

                            // All metrics for expanded panel
                            const metricGroups: Array<{ group: string; metrics: Array<{ label: string; value: string; highlight?: boolean }> }> = [
                              { group: "Alcance & Volume", metrics: [
                                { label: "Impressões", value: fmtInt(r.impressions) },
                                { label: "Alcance", value: fmtInt(r.reach) },
                                { label: "Cliques", value: fmtInt(r.clicks) },
                                { label: "Frequência", value: fmt(r.frequency, 2) },
                              ]},
                              { group: "Custo", metrics: [
                                { label: "Investimento", value: fmtCurrency(r.spend), highlight: true },
                                { label: "CPM", value: fmtCurrency(r.cpm) },
                                { label: "CPC", value: fmtCurrency(r.cpc) },
                                { label: "CTR", value: `${fmt(r.ctr, 2)}%`, highlight: true },
                              ]},
                              ...(() => {
                                const purchases = getPurchases(r.actions);
                                const revenue = getPurchaseValue(r.action_values);
                                const spend = parseFloat(r.spend ?? "0");
                                const roas = revenue > 0 && spend > 0 ? revenue / spend : null;
                                if (purchases > 0 || revenue > 0) return [{
                                  group: "Conversões",
                                  metrics: [
                                    { label: "Compras", value: fmtInt(purchases) },
                                    { label: "Receita", value: fmtCurrency(revenue) },
                                    { label: "ROAS", value: roas ? `${fmt(roas, 2)}x` : "—", highlight: true },
                                    { label: "CPA", value: purchases > 0 ? fmtCurrency(spend / purchases) : "—" },
                                  ],
                                }];
                                return [];
                              })(),
                              ...(() => {
                                const msgs = r.actions?.find(x => x.action_type === "onsite_conversion.messaging_conversation_started_7d");
                                const msgsCount = parseInt(msgs?.value ?? "0", 10);
                                const spend = parseFloat(r.spend ?? "0");
                                if (msgsCount > 0) return [{
                                  group: "Mensagens",
                                  metrics: [
                                    { label: "Conversas Iniciadas", value: fmtInt(msgsCount) },
                                    { label: "Custo por Conversa", value: msgsCount > 0 && spend > 0 ? fmtCurrency(spend / msgsCount) : "—", highlight: true },
                                  ],
                                }];
                                return [];
                              })(),
                              ...(() => {
                                const leads = r.actions?.find(x => x.action_type === "lead" || x.action_type === "offsite_conversion.fb_pixel_lead");
                                const leadsCount = parseInt(leads?.value ?? "0", 10);
                                const spend = parseFloat(r.spend ?? "0");
                                if (leadsCount > 0) return [{
                                  group: "Leads",
                                  metrics: [
                                    { label: "Leads", value: fmtInt(leadsCount) },
                                    { label: "Custo por Lead", value: leadsCount > 0 && spend > 0 ? fmtCurrency(spend / leadsCount) : "—", highlight: true },
                                  ],
                                }];
                                return [];
                              })(),
                              ...(() => {
                                const views = r.actions?.find(x => x.action_type === "video_view");
                                const viewsCount = parseInt(views?.value ?? "0", 10);
                                const spend = parseFloat(r.spend ?? "0");
                                if (viewsCount > 0) return [{
                                  group: "Vídeo",
                                  metrics: [
                                    { label: "Views Vídeo", value: fmtInt(viewsCount) },
                                    { label: "Custo por View", value: viewsCount > 0 && spend > 0 ? fmtCurrency(spend / viewsCount) : "—" },
                                  ],
                                }];
                                return [];
                              })(),
                            ];

                            // Adsets for this campaign
                            const campAdsets = adsets.filter(a => a.campaign_id === r.id);
                            // Ads/creatives for this campaign
                            const campAds = ads.filter(a => a.campaign_id ? a.campaign_id === r.id : a.campaign_name === r.name);

                            return (
                              <React.Fragment key={r.id}>
                                <tr
                                  ref={isHighlighted ? highlightedCampaignRef : undefined}
                                  onClick={() => toggleExpand(r.id)}
                                  className={`border-b transition-colors cursor-pointer group/row ${
                                    isExpanded
                                      ? "border-[#39FF14]/20 bg-[#39FF14]/[0.03]"
                                      : isHighlighted
                                        ? "border-[#39FF14]/30 bg-[#39FF14]/[0.04]"
                                        : "border-[#111] hover:bg-white/[0.02]"
                                  }`}>
                                  <td className="px-4 sm:px-6 py-3">
                                    <div className="flex items-center gap-2">
                                      <CampaignStatusBadge status={r.status} />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-white font-medium truncate max-w-[180px]">{r.name}</p>
                                          <ChevronDown size={12} className={`text-[#444] group-hover/row:text-[#39FF14] transition-all shrink-0 ${isExpanded ? "rotate-180 text-[#39FF14]" : ""}`} />
                                        </div>
                                        <div onClick={(e) => e.stopPropagation()}>
                                          <BudgetEditor
                                            campaignId={r.id}
                                            currentDailyBudget={(r as any).daily_budget}
                                            currentLifetimeBudget={(r as any).lifetime_budget}
                                            loading={isLoading}
                                            onSave={(type, val) => manageEntity("campaign", r.id, type, val)}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <HealthScoreBadge report={report} onClick={() => setHealthPanel(r)} />
                                  </td>
                                  {visibleCols.map((col) => {
                                    const check = report.checks.find((c) => c.key === col.id || (col.id === "ctr" && c.key === "ctr") || (col.id === "cpm" && c.key === "cpm") || (col.id === "frequency" && c.key === "frequency") || (col.id === "roas" && c.key === "roas") || (col.id === "cpp" && c.key === "cpl"));
                                    const kpiColor = check
                                      ? check.status === "good" ? "text-[#39FF14]" : check.status === "warning" ? "text-amber-400" : "text-rose-400"
                                      : col.highlight ? "text-[#39FF14]" : "text-gray-300";
                                    return (
                                      <td key={col.id} className={`px-3 py-3 ${col.align === "right" ? "text-right" : ""}`}>
                                        {col.id === "objective" ? (
                                          <ObjectiveBadge objective={r.objective} />
                                        ) : (
                                          <span className={`font-mono font-semibold ${kpiColor}`}>{col.getValue(r)}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <CampaignActionMenu
                                      campaignId={r.id}
                                      status={r.status}
                                      loading={isLoading}
                                      onAction={(action, value) => manageEntity("campaign", r.id, action, value)}
                                    />
                                  </td>
                                </tr>

                                {/* ── Expanded Detail Row ── */}
                                {isExpanded && (
                                  <tr className="border-b border-[#39FF14]/10 bg-[#050a05]">
                                    <td colSpan={totalCols} className="px-4 sm:px-6 py-5">
                                      {/* Header */}
                                      <div className="flex items-center gap-2 mb-4">
                                        <div className="w-1 h-4 rounded-full bg-[#39FF14]" />
                                        <p className="text-[11px] text-[#39FF14] font-semibold uppercase tracking-widest">Detalhe da Campanha</p>
                                        <p className="text-[11px] text-[#333] font-mono truncate">— {r.name}</p>
                                      </div>

                                      {/* Metric groups */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-5">
                                        {metricGroups.map(g => (
                                          <div key={g.group} className="rounded-xl bg-[#0B0F0D]/80 border border-[#1a1a1a] p-3">
                                            <p className="text-[9px] uppercase tracking-widest text-[#333] font-semibold mb-2">{g.group}</p>
                                            <div className="space-y-1.5">
                                              {g.metrics.map(m => (
                                                <div key={m.label} className="flex items-center justify-between gap-2">
                                                  <span className="text-[#555] text-[10px] leading-tight">{m.label}</span>
                                                  <span className={`font-mono font-bold text-[11px] ${m.highlight ? "text-[#39FF14]" : "text-white"}`}>{m.value}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Adsets sub-table */}
                                      {campAdsets.length > 0 && (
                                        <div className="mb-4">
                                          <p className="text-[10px] text-[#444] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                                            <Layers size={10} className="text-[#39FF14]" />Conjuntos de Anúncios ({campAdsets.length})
                                          </p>
                                          <div className="rounded-xl border border-[#1a1a1a] overflow-hidden overflow-x-auto">
                                            <table className="w-full text-[11px] min-w-[420px]">
                                              <thead>
                                                <tr className="border-b border-[#111]">
                                                  {["Conjunto", "Status", "Investimento", "Impressões", "Cliques", "CTR", "CPM"].map(h => (
                                                    <th key={h} className="px-3 py-2 text-left text-[#333] font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">{h}</th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {campAdsets.map(a => (
                                                  <tr key={a.id} className="border-b border-[#0d0d0d] hover:bg-white/[0.01]">
                                                    <td className="px-3 py-2 text-[#A0A0A0] max-w-[160px] truncate">{a.name}</td>
                                                    <td className="px-3 py-2"><CampaignStatusBadge status={a.status} /></td>
                                                    <td className="px-3 py-2 text-white font-mono">{fmtCurrency(a.spend)}</td>
                                                    <td className="px-3 py-2 text-white font-mono">{fmtInt(a.impressions)}</td>
                                                    <td className="px-3 py-2 text-white font-mono">{fmtInt(a.clicks)}</td>
                                                    <td className={`px-3 py-2 font-mono font-bold ${parseFloat(a.ctr) >= 3 ? "text-[#39FF14]" : parseFloat(a.ctr) < 1 ? "text-rose-400" : "text-amber-400"}`}>{fmt(a.ctr, 2)}%</td>
                                                    <td className="px-3 py-2 text-white font-mono">{fmtCurrency(a.cpm)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}

                                      {/* Ads sub-table */}
                                      {campAds.length > 0 && (
                                        <div>
                                          <p className="text-[10px] text-[#444] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                                            <Image size={10} className="text-[#39FF14]" />Anúncios ({campAds.length})
                                          </p>
                                          <div className="rounded-xl border border-[#1a1a1a] overflow-hidden overflow-x-auto">
                                            <table className="w-full text-[11px] min-w-[420px]">
                                              <thead>
                                                <tr className="border-b border-[#111]">
                                                  {["Anúncio", "Conjunto", "Investimento", "Impressões", "Cliques", "CTR", "CPC"].map(h => (
                                                    <th key={h} className="px-3 py-2 text-left text-[#333] font-semibold uppercase text-[10px] tracking-wider whitespace-nowrap">{h}</th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {campAds.map(a => (
                                                  <tr key={a.id} className="border-b border-[#0d0d0d] hover:bg-white/[0.01]">
                                                    <td className="px-3 py-2 text-[#A0A0A0] max-w-[160px] truncate">{a.name}</td>
                                                    <td className="px-3 py-2 text-[#555] max-w-[120px] truncate">{a.adset_name}</td>
                                                    <td className="px-3 py-2 text-white font-mono">{fmtCurrency(a.spend)}</td>
                                                    <td className="px-3 py-2 text-white font-mono">{fmtInt(a.impressions)}</td>
                                                    <td className="px-3 py-2 text-white font-mono">{fmtInt(a.clicks)}</td>
                                                    <td className={`px-3 py-2 font-mono font-bold ${parseFloat(a.ctr) >= 3 ? "text-[#39FF14]" : parseFloat(a.ctr) < 1 ? "text-rose-400" : "text-amber-400"}`}>{fmt(a.ctr, 2)}%</td>
                                                    <td className="px-3 py-2 text-white font-mono">{fmtCurrency(a.cpc)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}

                                      {campAdsets.length === 0 && campAds.length === 0 && (
                                        <p className="text-[#333] text-[11px] font-mono">Conjuntos e anúncios não disponíveis para este período.</p>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {filteredCampaigns.length === 0 && <div className="py-12 text-center text-gray-700 text-sm font-mono">Nenhuma campanha com dados no período</div>}
                  </SectionCard>
                </>
              );
            })()}

            {/* ── TAB: Conjuntos de Anúncios ── */}
            {activeTab === "adsets" && (
              <AdsetPanel
                adsets={adsets}
                loading={loading}
                actionLoading={actionLoading}
                onStatusChange={async (id, status) => {
                  setActionLoading(id);
                  setActionError(null);
                  try {
                    const res = await fetch("/api/meta/manage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "adset", id, action: "status", value: status }) });
                    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erro"); }
                    setAdsets((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
                  } catch (e: any) { setActionError(e.message); } finally { setActionLoading(null); }
                }}
                onBudgetChange={async (id, action, value) => {
                  setActionLoading(id);
                  setActionError(null);
                  try {
                    const res = await fetch("/api/meta/manage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "adset", id, action, value }) });
                    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erro"); }
                    setAdsets((prev) => prev.map((a) => a.id === id ? { ...a, [action]: String(value) } : a));
                  } catch (e: any) { setActionError(e.message); } finally { setActionLoading(null); }
                }}
              />
            )}

            {/* ── TAB: Criativos ── */}
            {activeTab === "creatives" && (
              <CreativeScorePanel creatives={creatives} ads={ads} />
            )}

            {/* ── TAB: Demográfico ── */}
            {activeTab === "demographics" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Por Idade */}
                <SectionCard title="Investimento por Idade" icon={Users}>
                  {ageData.length > 0 ? (
                    <div className="p-4 sm:p-6">
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={ageData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                          <XAxis dataKey="age" axisLine={false} tickLine={false} tick={{ fill: "#555", fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#555", fontSize: 10 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} />
                          <Tooltip formatter={(v: number) => [fmtCurrency(v), "Gasto"]} contentStyle={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "12px", fontSize: "12px" }} />
                          <Bar dataKey="spend" fill="#39FF14" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="py-12 text-center text-gray-700 text-sm font-mono">Sem dados demográficos</div>}
                </SectionCard>

                {/* Por Gênero */}
                <SectionCard title="Investimento por Gênero" icon={Users}>
                  {genderData.length > 0 ? (
                    <div className="p-4 sm:p-6">
                      <div className="space-y-4">
                        {genderData.map((g) => {
                          const total = genderData.reduce((s, x) => s + x.spend, 0) || 1;
                          const pct = Math.round((g.spend / total) * 100);
                          return (
                            <div key={g.gender} className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-300 text-sm">{g.gender}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-white text-sm font-bold font-mono">{fmtCurrency(g.spend)}</span>
                                  <span className="text-[#39FF14] text-xs font-semibold font-mono">{pct}%</span>
                                </div>
                              </div>
                              <div className="w-full h-3 bg-[#111] rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-[#1a8a0a] to-[#39FF14] transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : <div className="py-12 text-center text-gray-700 text-sm font-mono">Sem dados</div>}
                </SectionCard>

                {/* Por Região */}
                <SectionCard title="Top 10 Regiões" subtitle="Por investimento" icon={MapPin}>
                  {regionData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#1a1a1a]">
                            <th className="text-left text-gray-600 text-xs uppercase px-4 sm:px-6 py-3 font-semibold">#</th>
                            <th className="text-left text-gray-600 text-xs uppercase px-3 py-3 font-semibold">Região</th>
                            <th className="text-right text-gray-600 text-xs uppercase px-4 sm:px-6 py-3 font-semibold">Investimento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regionData.map((r, i) => (
                            <tr key={r.region} className="border-b border-[#111] hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 sm:px-6 py-3 text-gray-600 text-xs font-mono">{i + 1}</td>
                              <td className="px-3 py-3 text-white font-medium">{r.region}</td>
                              <td className="px-4 sm:px-6 py-3 text-right text-gray-300 font-medium font-mono">{fmtCurrency(r.spend)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="py-12 text-center text-gray-700 text-sm font-mono">Sem dados de região</div>}
                </SectionCard>
              </div>
            )}

          </>
        )}

        {/* ── TAB: Comparação de Períodos ── */}
        {!loading && activeTab === "comparison" && (
          <ComparisonPanel datePreset={datePreset} customSince={customSince} customUntil={customUntil} />
        )}

        {/* ── TAB: Regras de Automação ── */}
        {!loading && activeTab === "rules" && (
          <AutoRulesPanel
            rules={rules}
            campaigns={campaigns}
            onSave={(updated) => {
              setRules(updated);
              localStorage.setItem("dashads_rules", JSON.stringify(updated));
            }}
            onRun={async (rule) => {
              const triggered: string[] = [];
              for (const c of campaigns) {
                const actions = c.actions ?? [];
                const actionValues = c.action_values ?? [];
                const getVal = (type: string) => parseFloat(actions.find((a) => a.action_type === type)?.value ?? "0");
                const purchase = getVal("offsite_conversion.fb_pixel_purchase") + getVal("purchase");
                const purchaseValue = parseFloat(actionValues.find((a) => a.action_type === "offsite_conversion.fb_pixel_purchase")?.value ?? actionValues.find((a) => a.action_type === "purchase")?.value ?? "0");
                const spend = parseFloat(c.spend ?? "0");
                const roas = spend > 0 ? purchaseValue / spend : 0;
                const ctr = parseFloat(c.ctr ?? "0");
                const cpm = parseFloat(c.cpm ?? "0");
                const cpc = parseFloat(c.cpc ?? "0");
                const frequency = parseFloat(c.frequency ?? "0");
                const metricMap: Record<RuleMetric, number> = { roas, ctr, cpm, cpc, spend, frequency };
                const val = metricMap[rule.metric];
                const triggered_condition = rule.operator === "lt" ? val < rule.threshold : val > rule.threshold;
                if (triggered_condition) {
                  triggered.push(c.name);
                  if (rule.action === "pause" && c.status === "ACTIVE") {
                    setActionLoading(c.id);
                    try {
                      const res = await fetch("/api/meta/manage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "campaign", id: c.id, action: "status", value: "PAUSED" }) });
                      if (res.ok) setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: "PAUSED" } : x));
                    } finally { setActionLoading(null); }
                  }
                }
              }
              const now = new Date().toISOString();
              const updatedRules = rules.map((r) => r.id === rule.id ? { ...r, lastTriggered: now } : r);
              setRules(updatedRules);
              localStorage.setItem("dashads_rules", JSON.stringify(updatedRules));
              return triggered;
            }}
          />
        )}

        {/* ── TAB: Multi-Conta ── (independente de insights) */}
        {!loading && activeTab === "multi" && (
          <MultiAccountView datePreset={datePreset} accountNames={accountNames} />
        )}

        {/* ── TAB: UTM Builder ── (independente de insights) */}
        {!loading && activeTab === "utm" && <UTMEditor />}

        {/* ── TAB: Relatórios WhatsApp ── */}
        {activeTab === "reports" && (() => {
          const saveConfig = async () => {
            setWaSaving(true);
            setWaMsg(null);
            try {
              const res = await fetch("/api/reports/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...waConfig, schedule_hours: waConfig.schedule_hours.filter((h) => h >= 0) }),
              });
              const d = await res.json();
              if (!res.ok) throw new Error(d.error ?? "Erro ao salvar");
              if (d.config) setWaConfig((prev) => ({ ...prev, ...d.config }));
              setWaMsg({ type: "success", text: "Configurações salvas com sucesso!" });
            } catch (e: any) {
              setWaMsg({ type: "error", text: e.message ?? "Erro ao salvar" });
            } finally {
              setWaSaving(false);
              setTimeout(() => setWaMsg(null), 4000);
            }
          };

          const sendNow = async () => {
            setWaSending(true);
            setWaMsg(null);
            setWaPreview(null);
            try {
              const res = await fetch("/api/reports/whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date_preset: waConfig.date_preset }),
              });
              const d = await res.json();
              if (!res.ok) throw new Error(d.error ?? "Erro ao enviar");
              setWaMsg({ type: "success", text: "Relatório enviado com sucesso! ✅" });
              setWaPreview(d.message ?? null);
              setWaConfig((prev) => ({ ...prev, last_sent_at: new Date().toISOString() }));
            } catch (e: any) {
              setWaMsg({ type: "error", text: e.message ?? "Erro ao enviar" });
            } finally {
              setWaSending(false);
            }
          };

          const DATE_PRESETS = [
            { value: "today", label: "Hoje" },
            { value: "yesterday", label: "Ontem" },
            { value: "last_3d", label: "Últimos 3 dias" },
            { value: "last_7d", label: "Últimos 7 dias" },
            { value: "last_30d", label: "Últimos 30 dias" },
          ];

          const inputCls = "w-full bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#39FF14]/15 rounded-xl px-3 py-2.5 text-white text-sm placeholder-[#444] focus:outline-none focus:border-[#39FF14]/40 transition-colors";
          const labelCls = "block text-[11px] text-[#666] uppercase tracking-widest font-semibold mb-1.5";

          return (
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center shadow-[0_0_12px_rgba(37,211,102,0.08)]">
                  <MessageCircle size={18} className="text-[#25D366]" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Relatórios no WhatsApp</h2>
                  <p className="text-[#555] text-xs">Receba relatórios automáticos via WhatsApp usando Z-API</p>
                </div>
              </div>

              {/* Status banner */}
              {waMsg && (
                <div className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm ${waMsg.type === "success" ? "bg-[#39FF14]/[0.06] border-[#39FF14]/25 text-[#39FF14]" : "bg-rose-500/[0.06] border-rose-500/25 text-rose-400"}`}>
                  {waMsg.type === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {waMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* LEFT: Z-API Config */}
                <div className="rounded-2xl p-5 bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#39FF14]/10 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={13} className="text-[#39FF14]" />
                    <p className="text-[11px] text-[#666] uppercase tracking-widest font-semibold">Configuração Z-API</p>
                  </div>

                  <div>
                    <label className={labelCls}>Número WhatsApp</label>
                    <input
                      type="tel"
                      placeholder="11999999999 (com DDD)"
                      value={waConfig.phone}
                      onChange={(e) => setWaConfig((p) => ({ ...p, phone: e.target.value }))}
                      className={inputCls}
                    />
                    <p className="text-[#444] text-[10px] mt-1">Apenas números, sem espaços. Ex: 11987654321</p>
                  </div>

                  <div>
                    <label className={labelCls}>Instance ID</label>
                    <input
                      type="text"
                      placeholder="Ex: 3C4F2A1B9D8E"
                      value={waConfig.zapi_instance}
                      onChange={(e) => setWaConfig((p) => ({ ...p, zapi_instance: e.target.value }))}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Token Z-API</label>
                    <div className="relative">
                      <input
                        type={waShowToken ? "text" : "password"}
                        placeholder="Token da instância"
                        value={waConfig.zapi_token}
                        onChange={(e) => setWaConfig((p) => ({ ...p, zapi_token: e.target.value }))}
                        className={`${inputCls} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setWaShowToken((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#A0A0A0] transition-colors cursor-pointer"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                    <p className="text-[#444] text-[10px] mt-1">Encontrado no painel Z-API → sua instância → Token</p>
                  </div>

                  {/* How to get Z-API */}
                  <div className="p-3 rounded-xl bg-[#39FF14]/[0.03] border border-[#39FF14]/10 text-[11px] text-[#555] space-y-1">
                    <p className="text-[#666] font-semibold">Como configurar Z-API:</p>
                    <p>1. Acesse z-api.io e crie uma conta</p>
                    <p>2. Crie uma instância e conecte seu WhatsApp</p>
                    <p>3. Copie o Instance ID e o Token aqui</p>
                  </div>
                </div>

                {/* RIGHT: Schedule Config */}
                <div className="rounded-2xl p-5 bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#39FF14]/10 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={13} className="text-[#39FF14]" />
                    <p className="text-[11px] text-[#666] uppercase tracking-widest font-semibold">Agendamento</p>
                  </div>

                  {/* Enable toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0F0D]/40 border border-[#39FF14]/10">
                    <div>
                      <p className="text-white text-sm font-semibold">Envio automático</p>
                      <p className="text-[#555] text-[11px]">Ativar relatórios agendados</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setWaConfig((p) => ({ ...p, enabled: !p.enabled }))}
                      className="cursor-pointer"
                    >
                      {waConfig.enabled
                        ? <ToggleRight size={30} className="text-[#39FF14] drop-shadow-[0_0_6px_rgba(57,255,20,0.4)]" />
                        : <ToggleLeft size={30} className="text-[#444]" />
                      }
                    </button>
                  </div>

                  <div>
                    <label className={labelCls}>Frequência</label>
                    <select
                      value={waConfig.schedule}
                      onChange={(e) => setWaConfig((p) => ({ ...p, schedule: e.target.value }))}
                      className={`${inputCls} cursor-pointer`}
                    >
                      <option value="manual">Manual (somente botão)</option>
                      <option value="daily">Diário</option>
                      <option value="weekly">Semanal (toda segunda)</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Horários de envio — até 4 por dia (Brasília)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1, 2, 3].map((slot) => {
                        const localValue = waConfig.schedule_hours[slot] ?? -1;
                        return (
                          <div key={slot} className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-[#555] font-semibold pointer-events-none">
                              {slot + 1}
                            </div>
                            <select
                              value={localValue}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                setWaConfig((p) => {
                                  const arr = [...(p.schedule_hours.length >= 4 ? p.schedule_hours : [11, -1, -1, -1])];
                                  arr[slot] = v;
                                  return { ...p, schedule_hours: arr };
                                });
                              }}
                              disabled={waConfig.schedule === "manual"}
                              className={`${inputCls} pl-7 cursor-pointer text-sm`}
                            >
                              <option value={-1}>— Desativado</option>
                              {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map((h) => (
                                <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[#444] text-[10px] mt-1.5">Selecione até 4 horários diários. "Desativado" ignora o slot.</p>
                  </div>

                  <div>
                    <label className={labelCls}>Período do relatório</label>
                    <select
                      value={waConfig.date_preset}
                      onChange={(e) => setWaConfig((p) => ({ ...p, date_preset: e.target.value }))}
                      className={`${inputCls} cursor-pointer`}
                    >
                      {DATE_PRESETS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>

                  {waConfig.last_sent_at && (
                    <div className="p-2.5 rounded-xl bg-[#0B0F0D]/40 border border-[#39FF14]/10">
                      <p className="text-[#555] text-[10px] uppercase tracking-wider font-semibold mb-0.5">Último envio</p>
                      <p className="text-[#A0A0A0] text-xs font-mono">{new Date(waConfig.last_sent_at).toLocaleString("pt-BR")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={saveConfig}
                  disabled={waSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B0F0D]/80 backdrop-blur-sm border border-[#39FF14]/25 text-[#39FF14] text-sm font-semibold hover:bg-[#39FF14]/10 hover:border-[#39FF14]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {waSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {waSaving ? "Salvando..." : "Salvar Configurações"}
                </button>

                <button
                  onClick={sendNow}
                  disabled={waSending || !waConfig.phone || !waConfig.zapi_instance || !(waConfig.zapi_token || waConfig.zapi_token_configured)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/25 text-[#25D366] text-sm font-semibold hover:bg-[#25D366]/20 hover:border-[#25D366]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {waSending ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
                  {waSending ? "Enviando..." : "Enviar Agora"}
                </button>
              </div>

              {/* Preview */}
              {waPreview && (
                <div className="rounded-2xl p-5 bg-[#0B0F0D]/60 backdrop-blur-sm border border-[#25D366]/15">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageCircle size={13} className="text-[#25D366]" />
                    <p className="text-[11px] text-[#666] uppercase tracking-widest font-semibold">Prévia do Relatório Enviado</p>
                  </div>
                  <div className="bg-[#111] rounded-xl p-4 font-mono text-xs text-[#A0A0A0] leading-relaxed whitespace-pre-wrap border border-[#1a1a1a]">
                    {waPreview}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <footer className="text-center py-4 sm:py-6 border-t border-[#111]">
          <p className="text-gray-800 text-xs font-mono">DashAds Pro © 2024 • Dashboard de Gestão de Tráfego Pago</p>
        </footer>
      </main>
    </div>
  );
}
