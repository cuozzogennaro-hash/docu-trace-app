import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import CompanyHeader from "@/components/CompanyHeader";
import { Sparkles, Thermometer, Package, Factory, AlertTriangle, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";

type OverdueTask = {
  assignment_id: string;
  operator_name: string;
  asset_name: string;
  task_type: string;
  due_time: string;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [checklistKey, setChecklistKey] = useState(0);
  const [stats, setStats] = useState({
    sanitToday: 0,
    tempToday: 0,
    rawMaterials: 0,
    products: 0,
    outOfStock: 0,
    missingToday: false,
  });
  const [overdue, setOverdue] = useState<OverdueTask[]>([]);

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
      const [s, t, rm, pr, oos] = await Promise.all([
        supabase.from("sanitations").select("id", { count: "exact", head: true }).eq("event_date", today),
        supabase.from("temperatures").select("id", { count: "exact", head: true }).eq("event_date", today),
        supabase.from("raw_materials").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("raw_materials").select("id", { count: "exact", head: true }).eq("is_out_of_stock", true),
      ]);
      setStats({
        sanitToday: s.count ?? 0,
        tempToday: t.count ?? 0,
        rawMaterials: rm.count ?? 0,
        products: pr.count ?? 0,
        outOfStock: oos.count ?? 0,
        missingToday: (s.count ?? 0) === 0 || (t.count ?? 0) === 0,
      });
    })();
  }, []);

  const tiles = [
    { to: "/sanificazione", icon: Sparkles, label: t("Sanificazioni oggi"), value: stats.sanitToday, color: "bg-gradient-primary" },
    { to: "/temperature", icon: Thermometer, label: t("Rilevazioni oggi"), value: stats.tempToday, color: "bg-gradient-primary" },
    { to: "/ingresso", icon: Package, label: t("Materie prime"), value: stats.rawMaterials, color: "bg-gradient-accent" },
    { to: "/produzione", icon: Factory, label: t("Prodotti registrati"), value: stats.products, color: "bg-gradient-accent" },
  ];

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
        <Card className="p-5 lg:p-6 bg-orange-500 hover:bg-orange-600 transition cursor-pointer border-orange-600 shadow-elevated flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Package className="text-white" size={28} />
          </div>
          <div className="flex-1 min-w-0">
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
            {overdue.map((t) => (
              <li key={t.assignment_id} className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-3 py-2">
                <div>
                  <div className="font-medium">{t.operator_name}</div>
                  <div className="text-muted-foreground text-xs">
                    {t.task_type === "sanitation" ? "Sanificazione" : "Rilevazione temperatura"} • {t.asset_name}
                  </div>
                </div>
                <div className="text-xs font-mono text-destructive shrink-0">h {t.due_time?.slice(0, 5)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="p-4 lg:p-5 hover:shadow-elevated transition cursor-pointer h-full">
              <div className={`h-11 w-11 rounded-xl ${t.color} flex items-center justify-center mb-3`}>
                <t.icon className="text-primary-foreground" size={20} />
              </div>
              <div className="font-display text-3xl font-bold">{t.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
            </Card>
          </Link>
        ))}
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