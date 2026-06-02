import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Layers, Refrigerator, UserPlus, Check, ChevronRight, X, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Status = { company: boolean; departments: boolean; assets: boolean; operators: boolean };

const STORAGE_KEY = "haccp.checklist.dismissed";

export default function OnboardingChecklist({ onRestart }: { onRestart: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, d, a, o] = await Promise.all([
        supabase.from("company_settings").select("business_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("departments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("operators").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setStatus({
        company: !!c.data?.business_name,
        departments: (d.count ?? 0) > 0,
        assets: (a.count ?? 0) > 0,
        operators: (o.count ?? 0) > 0,
      });
    })();
  }, [user]);

  if (!status || dismissed) return null;
  const total = 4;
  const done = Object.values(status).filter(Boolean).length;
  if (done === total) return null;

  const items = [
    { key: "company", label: t("Dati azienda"), icon: Building2, done: status.company, href: "/impostazioni?tab=azienda" },
    { key: "departments", label: t("Reparti"), icon: Layers, done: status.departments, href: "/impostazioni?tab=reparti" },
    { key: "assets", label: t("Attrezzature"), icon: Refrigerator, done: status.assets, href: "/impostazioni?tab=attrezzature" },
    { key: "operators", label: t("Operatori"), icon: UserPlus, done: status.operators, href: "/impostazioni?tab=operatori" },
  ];

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <Card className="p-4 mb-6 border-primary/30 bg-primary/5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
            <Sparkles className="text-primary-foreground" size={18} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold">{t("Completa la configurazione")}</div>
            <div className="text-xs text-muted-foreground">{t("{{n}} di {{total}} passi completati", { n: done, total })}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={onRestart}>{t("Riprendi tour")}</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={dismiss} title={t("Nascondi")}>
            <X size={14} />
          </Button>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
        <div className="h-full bg-gradient-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((it) => (
          <Link key={it.key} to={it.href}>
            <div className={`flex items-center gap-2 p-2 rounded-lg border transition hover:bg-background/60 ${it.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-background/40"}`}>
              <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${it.done ? "bg-emerald-500 text-white" : "bg-muted"}`}>
                {it.done ? <Check size={14} /> : <it.icon size={14} />}
              </div>
              <span className={`text-sm flex-1 ${it.done ? "text-muted-foreground line-through" : "font-medium"}`}>{it.label}</span>
              {!it.done && <ChevronRight size={14} className="text-muted-foreground" />}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}