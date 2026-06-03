import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import CompanyHeader from "@/components/CompanyHeader";
import {
  Sparkles, Thermometer, Package, Factory, AlertTriangle, ShoppingCart,
  CalendarClock, ShieldAlert, Activity, ChevronLeft, ChevronRight, Pause, Play,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { computeProductExpiry, getExpiryStatus } from "@/lib/expiry";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceArea, BarChart, Bar, Legend,
} from "recharts";

type OverdueTask = {
  assignment_id: string;
  operator_name: string;
  asset_name: string;
  task_type: string;
  due_time: string;
};

type AssetSeries = {
  id: string;
  name: string;
  min: number | null;
  max: number | null;
  data: { date: string; label: string; temp: number | null }[];
};

type ExpiryItem = {
  id: string;
  kind: "raw" | "product" | "preparation";
  name: string;
  expiry: string;
  status: ReturnType<typeof getExpiryStatus>;
};

type NCItem = {
  id: string;
  title: string;
  area: string;
  severity: "low" | "medium" | "high";
  detected_at: string;
};

const ROTATE_MS = 7000;

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [checklistKey, setChecklistKey] = useState(0);
  const [stats, setStats] = useState({
    sanitToday: 0,
    tempToday: 0,
    tempExpected: 0,
    sanitExpected: 0,
    rawMaterials: 0,
    products: 0,
    outOfStock: 0,
    missingToday: false,
    expired: 0,
    expiringSoon: 0,
    ncOpen: 0,
  });
  const [overdue, setOverdue] = useState<OverdueTask[]>([]);
  const [assetSeries, setAssetSeries] = useState<AssetSeries[]>([]);
  const [activityData, setActivityData] = useState<{ day: string; ingressi: number; lavorazioni: number; sanificazioni: number }[]>([]);
  const [topExpiries, setTopExpiries] = useState<ExpiryItem[]>([]);
  const [topNC, setTopNC] = useState<NCItem[]>([]);
  const [assetIdx, setAssetIdx] = useState(0);
  const [rotating, setRotating] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
      if (data && (data as any).onboarding_completed === false) {
        setWizardOpen(true);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      const { data } = await supabase.rpc("admin_overdue_tasks", { p_user_id: user!.id });
      if (cancelled) return;
      const tasks = (data as any)?.tasks ?? [];
      setOverdue(tasks);
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user]);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [s, tmp, rm, pr, oos, rmExp, prExp, prepExp, shelfRes, expectedTemp, expectedSanit, nc] = await Promise.all([
        supabase.from("sanitations").select("id", { count: "exact", head: true }).eq("event_date", today),
        supabase.from("temperatures").select("id", { count: "exact", head: true }).eq("event_date", today),
        supabase.from("raw_materials").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("raw_materials").select("id", { count: "exact", head: true }).eq("is_out_of_stock", true),
        supabase.from("raw_materials").select("expiry_date").eq("is_out_of_stock", false).not("expiry_date", "is", null),
        supabase.from("products").select("production_date, preservation_type"),
        supabase.from("preparations").select("internal_expiry"),
        supabase.from("label_rules" as any).select("params").eq("department_key", "salumeria").eq("rule_key", "shelf_life").maybeSingle(),
        supabase.from("task_assignments").select("id", { count: "exact", head: true }).eq("task_type", "temperature"),
        supabase.from("task_assignments").select("id", { count: "exact", head: true }).eq("task_type", "sanitation"),
        supabase.from("non_conformities").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      const shelf = ((shelfRes as any).data?.params ?? {}) as { days_fresh?: number; days_vacuum?: number };
      let expired = 0, expiringSoon = 0;
      const tally = (iso: string | null | undefined) => {
        const st = getExpiryStatus(iso);
        if (st === "expired") expired++;
        else if (st === "today" || st === "soon") expiringSoon++;
      };
      for (const r of ((rmExp.data as any[]) ?? [])) tally(r.expiry_date);
      for (const r of ((prExp.data as any[]) ?? [])) tally(computeProductExpiry(r.production_date, r.preservation_type, shelf));
      for (const r of ((prepExp.data as any[]) ?? [])) tally(r.internal_expiry ? String(r.internal_expiry).slice(0, 10) : null);
      setStats({
        sanitToday: s.count ?? 0,
        tempToday: tmp.count ?? 0,
        tempExpected: expectedTemp.count ?? 0,
        sanitExpected: expectedSanit.count ?? 0,
        rawMaterials: rm.count ?? 0,
        products: pr.count ?? 0,
        outOfStock: oos.count ?? 0,
        missingToday: (s.count ?? 0) === 0 || (tmp.count ?? 0) === 0,
        expired,
        expiringSoon,
        ncOpen: nc.count ?? 0,
      });
    })();
  }, []);

  // === Carica grafici ed elenchi top ===
  useEffect(() => {
    (async () => {
      const today = new Date();
      const days: { iso: string; label: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        days.push({ iso, label: d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" }) });
      }
      const fromIso = days[0].iso;

      const [assetsRes, tempRes, incRes, prodRes, sanitRes, expRm, expPr, expPrep, shelfRes, ncRes] =
        await Promise.all([
          supabase.from("assets").select("id, name, target_temp_min, target_temp_max"),
          supabase.from("temperatures").select("asset_id, temperature, event_date").gte("event_date", fromIso),
          supabase.from("raw_materials").select("created_at").gte("created_at", fromIso),
          supabase.from("products").select("created_at").gte("created_at", fromIso),
          supabase.from("sanitations").select("event_date").gte("event_date", fromIso),
          supabase.from("raw_materials").select("id, product_name, expiry_date").eq("is_out_of_stock", false).not("expiry_date", "is", null),
          supabase.from("products").select("id, name, production_date, preservation_type").eq("is_out_of_stock", false),
          supabase.from("preparations").select("id, name, internal_expiry").eq("is_out_of_stock", false),
          supabase.from("label_rules" as any).select("params").eq("department_key", "salumeria").eq("rule_key", "shelf_life").maybeSingle(),
          supabase.from("non_conformities").select("id, title, area, severity, detected_at").eq("status", "open").order("detected_at", { ascending: false }).limit(5),
        ]);

      // ====== Serie temperature per asset ======
      const assets = (assetsRes.data ?? []) as any[];
      const temps = (tempRes.data ?? []) as any[];
      const series: AssetSeries[] = assets
        .map((a) => {
          const byDate = new Map<string, number[]>();
          for (const tr of temps) {
            if (tr.asset_id !== a.id) continue;
            const list = byDate.get(tr.event_date) ?? [];
            list.push(Number(tr.temperature));
            byDate.set(tr.event_date, list);
          }
          const data = days.map((d) => {
            const arr = byDate.get(d.iso);
            const avg = arr && arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
            return { date: d.iso, label: d.label, temp: avg };
          });
          return {
            id: a.id,
            name: a.name,
            min: a.target_temp_min ?? null,
            max: a.target_temp_max ?? null,
            data,
          };
        })
        .filter((s) => s.data.some((d) => d.temp !== null));
      setAssetSeries(series);

      // ====== Attività settimanale ======
      const ingPerDay = new Map<string, number>();
      const prodPerDay = new Map<string, number>();
      const sanPerDay = new Map<string, number>();
      for (const r of (incRes.data ?? []) as any[]) {
        const k = String(r.created_at).slice(0, 10);
        ingPerDay.set(k, (ingPerDay.get(k) ?? 0) + 1);
      }
      for (const r of (prodRes.data ?? []) as any[]) {
        const k = String(r.created_at).slice(0, 10);
        prodPerDay.set(k, (prodPerDay.get(k) ?? 0) + 1);
      }
      for (const r of (sanitRes.data ?? []) as any[]) {
        sanPerDay.set(r.event_date, (sanPerDay.get(r.event_date) ?? 0) + 1);
      }
      setActivityData(days.map((d) => ({
        day: d.label,
        ingressi: ingPerDay.get(d.iso) ?? 0,
        lavorazioni: prodPerDay.get(d.iso) ?? 0,
        sanificazioni: sanPerDay.get(d.iso) ?? 0,
      })));

      // ====== Top 5 scadenze ======
      const shelf = ((shelfRes as any).data?.params ?? {}) as { days_fresh?: number; days_vacuum?: number };
      const all: ExpiryItem[] = [];
      for (const r of (expRm.data ?? []) as any[]) {
        if (!r.expiry_date) continue;
        all.push({ id: r.id, kind: "raw", name: r.product_name, expiry: r.expiry_date, status: getExpiryStatus(r.expiry_date) });
      }
      for (const r of (expPr.data ?? []) as any[]) {
        const e = computeProductExpiry(r.production_date, r.preservation_type, shelf);
        if (!e) continue;
        all.push({ id: r.id, kind: "product", name: r.name, expiry: e, status: getExpiryStatus(e) });
      }
      for (const r of (expPrep.data ?? []) as any[]) {
        const e = r.internal_expiry ? String(r.internal_expiry).slice(0, 10) : null;
        if (!e) continue;
        all.push({ id: r.id, kind: "preparation", name: r.name, expiry: e, status: getExpiryStatus(e) });
      }
      all.sort((a, b) => a.expiry.localeCompare(b.expiry));
      const filtered = all.filter((r) => r.status !== "ok");
      setTopExpiries(filtered.slice(0, 5));

      // ====== NC ======
      setTopNC(((ncRes.data ?? []) as any[]).map((n) => ({
        id: n.id, title: n.title, area: n.area, severity: n.severity, detected_at: n.detected_at,
      })));
    })();
  }, []);

  // === Rotazione automatica fra asset ===
  useEffect(() => {
    if (!rotating || assetSeries.length <= 1) return;
    const id = setInterval(() => setAssetIdx((i) => (i + 1) % assetSeries.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [rotating, assetSeries.length]);
  useEffect(() => { if (assetIdx >= assetSeries.length) setAssetIdx(0); }, [assetSeries.length, assetIdx]);

  const currentAsset = assetSeries[assetIdx];

  const kpis = useMemo(() => [
    {
      to: "/temperature",
      icon: Thermometer,
      label: t("Temperature oggi"),
      value: `${stats.tempToday}${stats.tempExpected ? "/" + stats.tempExpected : ""}`,
      sub: stats.tempExpected ? t("rilevazioni previste") : t("rilevazioni"),
      tone: "from-emerald-500 to-teal-500",
    },
    {
      to: "/sanificazione",
      icon: Sparkles,
      label: t("Sanificazioni oggi"),
      value: `${stats.sanitToday}${stats.sanitExpected ? "/" + stats.sanitExpected : ""}`,
      sub: stats.sanitExpected ? t("sanificazioni previste") : t("interventi"),
      tone: "from-sky-500 to-cyan-500",
    },
    {
      to: "/scadenze",
      icon: CalendarClock,
      label: t("In scadenza < 7gg"),
      value: String(stats.expired + stats.expiringSoon),
      sub: stats.expired ? t("{{n}} già scaduti", { n: stats.expired }) : t("tutto sotto controllo"),
      tone: stats.expired ? "from-rose-500 to-red-500" : "from-amber-500 to-orange-500",
    },
    {
      to: "/non-conformita",
      icon: ShieldAlert,
      label: t("Non conformità aperte"),
      value: String(stats.ncOpen),
      sub: stats.ncOpen ? t("da risolvere") : t("nessuna aperta"),
      tone: stats.ncOpen ? "from-orange-500 to-rose-500" : "from-emerald-500 to-teal-500",
    },
  ], [stats, t]);

  return (
    <>
      <CompanyHeader />
      <PageHeader title="Dashboard" subtitle={"Panoramica del tuo autocontrollo HACCP"} />

      <OnboardingChecklist key={checklistKey} onRestart={() => setWizardOpen(true)} />
      <OnboardingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCompleted={() => setChecklistKey((k) => k + 1)}
      />

      <Link to="/ingresso" className="block mb-6">
        <Card className="relative overflow-hidden p-5 lg:p-6 border-0 cursor-pointer shadow-elevated bg-gradient-to-br from-orange-500 via-orange-500 to-amber-600 hover:shadow-[0_20px_50px_-15px_hsl(28_95%_55%/0.55)] transition-all flex items-center gap-4">
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -right-4 -bottom-10 h-32 w-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 ring-1 ring-white/30">
            <Package className="text-white" size={28} />
          </div>
          <div className="flex-1 min-w-0 relative">
            <div className="font-display font-bold text-xl lg:text-2xl text-white">{t("Ingresso merci")}</div>
            <div className="text-sm text-white/90">{t("Registra una nuova consegna")}</div>
          </div>
        </Card>
      </Link>

      {stats.missingToday && (
        <Card className="p-4 mb-6 border-warning/40 bg-warning/5 flex items-start gap-3">
          <AlertTriangle className="text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-foreground">{t("Registri incompleti oggi")}</div>
            <p className="text-muted-foreground">{t("Ricordati di compilare sanificazioni e rilevazioni temperature.")}</p>
          </div>
        </Card>
      )}

      {overdue.length > 0 && (
        <Card className="p-4 mb-6 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-foreground">{t("Compiti operatore in ritardo")}</div>
              <p className="text-muted-foreground">{t("Questi compiti non sono stati eseguiti entro 30 minuti dall'orario previsto.")}</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {overdue.map((task) => (
              <li key={task.assignment_id} className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-3 py-2">
                <div>
                  <div className="font-medium">{task.operator_name}</div>
                  <div className="text-muted-foreground text-xs">
                    {task.task_type === "sanitation" ? t("Sanificazione") : t("Rilevazione temperatura")} • {task.asset_name}
                  </div>
                </div>
                <div className="text-xs font-mono text-destructive shrink-0">{t("h")} {task.due_time?.slice(0, 5)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* === KPI === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {kpis.map((k) => (
          <Link key={k.to} to={k.to} className="group">
            <Card className="relative overflow-hidden p-4 lg:p-5 h-full border-0 shadow-soft hover:shadow-elevated transition-all hover:-translate-y-0.5">
              <div className={`absolute inset-0 opacity-[0.07] bg-gradient-to-br ${k.tone}`} />
              <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${k.tone} flex items-center justify-center mb-3 shadow-md`}>
                <k.icon className="text-white" size={20} />
              </div>
              <div className="font-display text-3xl font-bold tracking-tight">{k.value}</div>
              <div className="text-xs font-medium text-foreground/80 mt-1">{k.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* === Grafici === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        {/* Temperature per asset (rotante) */}
        <Card className="relative overflow-hidden p-5 border-0 shadow-soft hover:shadow-elevated transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/10 pointer-events-none" />
          <div className="relative flex items-start justify-between mb-3 gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <Thermometer size={13} className="text-emerald-600" />
                {t("Trend temperature 7 giorni")}
              </div>
              <div className="font-display text-lg font-bold mt-1 truncate">
                {currentAsset?.name ?? t("Nessun dato")}
              </div>
              {currentAsset && (currentAsset.min !== null || currentAsset.max !== null) && (
                <div className="text-[11px] text-muted-foreground">
                  {t("Target")}: {currentAsset.min ?? "—"}° / {currentAsset.max ?? "—"}°
                </div>
              )}
            </div>
            {assetSeries.length > 1 && (
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAssetIdx((i) => (i - 1 + assetSeries.length) % assetSeries.length)} aria-label={t("Asset precedente")}>
                  <ChevronLeft size={14} />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRotating((r) => !r)} title={rotating ? t("Pausa rotazione") : t("Riprendi rotazione")}>
                  {rotating ? <Pause size={13} /> : <Play size={13} />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAssetIdx((i) => (i + 1) % assetSeries.length)} aria-label={t("Asset successivo")}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </div>
          <div className="relative h-[200px]">
            {currentAsset ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentAsset.data} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(165 72% 32%)" />
                      <stop offset="100%" stopColor="hsl(160 70% 45%)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="°" />
                  {currentAsset.min !== null && currentAsset.max !== null && (
                    <ReferenceArea y1={currentAsset.min} y2={currentAsset.max} fill="hsl(150 65% 40%)" fillOpacity={0.08} />
                  )}
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-elevated)", fontSize: 12 }}
                    formatter={(v: any) => v === null ? "—" : `${Number(v).toFixed(1)}°`}
                  />
                  <Line type="monotone" dataKey="temp" stroke="url(#tempGrad)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(165 72% 32%)" }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                {t("Nessuna rilevazione negli ultimi 7 giorni")}
              </div>
            )}
          </div>
          {assetSeries.length > 1 && (
            <div className="relative mt-2 flex justify-center gap-1.5">
              {assetSeries.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setAssetIdx(i); setRotating(false); }}
                  className={`h-1.5 rounded-full transition-all ${i === assetIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Attività settimanale */}
        <Card className="relative overflow-hidden p-5 border-0 shadow-soft hover:shadow-elevated transition-all">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-violet-500/10 pointer-events-none" />
          <div className="relative mb-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <Activity size={13} className="text-sky-600" />
              {t("Attività 7 giorni")}
            </div>
              <h2 className="font-display text-lg font-bold mt-1">{t("Ingressi · Lavorazioni · Sanificazioni")}</h2>
          </div>
          <div className="relative h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-elevated)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="ingressi" name={t("Ingressi") as string} stackId="a" fill="hsl(28 95% 55%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="lavorazioni" name={t("Lavorazioni") as string} stackId="a" fill="hsl(165 72% 32%)" />
                <Bar dataKey="sanificazioni" name={t("Sanificazioni") as string} stackId="a" fill="hsl(210 90% 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* === Liste azionabili === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Top scadenze */}
        <Card className="p-5 border-0 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <CalendarClock size={13} className="text-orange-600" />
                {t("Prossime scadenze")}
              </div>
              <h2 className="font-display text-lg font-bold mt-1">{t("Top 5")}</h2>
            </div>
            <Link to="/scadenze" className="text-xs font-semibold text-primary hover:underline">{t("Vedi tutte")}</Link>
          </div>
          {topExpiries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("Nessuna scadenza imminente.")}</p>
          ) : (
            <ul className="space-y-1.5">
              {topExpiries.map((e) => {
                const dot = e.status === "expired" ? "bg-destructive" : e.status === "today" ? "bg-orange-500" : e.status === "soon" ? "bg-yellow-500" : "bg-emerald-500";
                return (
                  <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition">
                    <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {e.kind === "raw" ? t("Materia prima") : e.kind === "product" ? t("Prodotto") : t("Preparazione")}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-foreground/80 shrink-0">
                      {new Date(e.expiry).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Top NC */}
        <Card className="p-5 border-0 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                <ShieldAlert size={13} className="text-destructive" />
                {t("Ultime non conformità")}
              </div>
              <h2 className="font-display text-lg font-bold mt-1">{t("Aperte")}</h2>
            </div>
            <Link to="/non-conformita" className="text-xs font-semibold text-primary hover:underline">{t("Vedi tutte")}</Link>
          </div>
          {topNC.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t("Nessuna non conformità aperta.")}</p>
          ) : (
            <ul className="space-y-1.5">
              {topNC.map((n) => (
                <li key={n.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition">
                  <Badge variant={n.severity === "high" ? "destructive" : n.severity === "medium" ? "default" : "secondary"} className="text-[10px] uppercase shrink-0">
                    {n.severity === "high" ? t("Alta") : n.severity === "medium" ? t("Media") : t("Bassa")}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(n.detected_at).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* === Scorciatoie segondarie === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <Link to="/ingresso">
          <Card className="p-4 border-0 shadow-soft hover:shadow-elevated transition flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shrink-0">
              <Package className="text-white" size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-xl leading-none">{stats.rawMaterials}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{t("Materie prime")}</div>
            </div>
          </Card>
        </Link>
        <Link to="/produzione">
          <Card className="p-4 border-0 shadow-soft hover:shadow-elevated transition flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <Factory className="text-white" size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-xl leading-none">{stats.products}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{t("Lavorazioni")}</div>
            </div>
          </Card>
        </Link>
        <Link to="/acquisti">
          <Card className="p-4 border-0 shadow-soft hover:shadow-elevated transition flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shrink-0">
              <ShoppingCart className="text-white" size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-xl leading-none">{stats.outOfStock}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{t("Da riordinare")}</div>
            </div>
          </Card>
        </Link>
        <Link to="/report">
          <Card className="p-4 border-0 shadow-soft hover:shadow-elevated transition flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
              <Activity className="text-white" size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-base leading-tight">{t("Report")}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{t("HACCP")}</div>
            </div>
          </Card>
        </Link>
      </div>

      {stats.outOfStock > 0 && (
        <Link to="/acquisti">
          <Card className="mt-6 p-4 flex items-center gap-4 hover:shadow-elevated transition cursor-pointer">
            <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center">
              <ShoppingCart className="text-accent-foreground" size={20} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{t("Lista acquisti")}</div>
              <div className="text-sm text-muted-foreground">{t("{{count}} articoli esauriti da riordinare", { count: stats.outOfStock })}</div>
            </div>
          </Card>
        </Link>
      )}
    </>
  );
}