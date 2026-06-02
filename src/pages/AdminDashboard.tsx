import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Users, CheckCircle2, Clock, CreditCard } from "lucide-react";

type AdminUser = {
  id: string;
  email: string | null;
  business_name: string | null;
  created_at: string;
  last_seen_at: string | null;
  onboarding_completed: boolean;
  subscription: {
    status: string;
    environment: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    paddle_subscription_id: string | null;
  } | null;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function isPaying(s: AdminUser["subscription"]) {
  if (!s) return false;
  if (s.status === "trialing") return false;
  if (s.paddle_subscription_id?.startsWith("local_trial_")) return false;
  return ["active", "past_due"].includes(s.status);
}

function isTrialing(s: AdminUser["subscription"]) {
  return s?.status === "trialing" || s?.paddle_subscription_id?.startsWith("local_trial_");
}

export default function AdminDashboard() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      setFetching(true);
      const { data, error } = await supabase.rpc("super_admin_overview" as any);
      if (!error && data && (data as any).ok) {
        setUsers((data as any).users || []);
      }
      setFetching(false);
    })();
  }, [isSuperAdmin]);

  if (loading) return <div className="p-8 text-muted-foreground">Caricamento…</div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const filtered = users.filter((u) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (u.email || "").toLowerCase().includes(q) || (u.business_name || "").toLowerCase().includes(q);
  });

  const total = users.length;
  const paying = users.filter((u) => isPaying(u.subscription)).length;
  const trialing = users.filter((u) => isTrialing(u.subscription)).length;
  const activeLast7 = users.filter((u) => {
    if (!u.last_seen_at) return false;
    return new Date(u.last_seen_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
          <ShieldCheck className="text-primary-foreground" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboard supervisore</h1>
          <p className="text-sm text-muted-foreground">Panoramica utenti, prove e abbonamenti</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Utenti totali" value={total} />
        <StatCard icon={Clock} label="In prova" value={trialing} />
        <StatCard icon={CreditCard} label="Paganti" value={paying} />
        <StatCard icon={CheckCircle2} label="Attivi ultimi 7gg" value={activeLast7} />
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca per email o ragione sociale…"
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Azienda</th>
                <th className="text-left px-3 py-2">Registrato</th>
                <th className="text-left px-3 py-2">Ultimo accesso</th>
                <th className="text-left px-3 py-2">Stato</th>
                <th className="text-left px-3 py-2">Scade</th>
              </tr>
            </thead>
            <tbody>
              {fetching && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Caricamento…</td></tr>
              )}
              {!fetching && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nessun utente</td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{u.email || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.business_name || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.created_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.last_seen_at)}</td>
                  <td className="px-3 py-2"><StatusBadge sub={u.subscription} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.subscription?.current_period_end ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ sub }: { sub: AdminUser["subscription"] }) {
  if (!sub) return <Badge variant="outline">Nessuno</Badge>;
  if (isPaying(sub)) return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pagante</Badge>;
  if (isTrialing(sub)) return <Badge className="bg-amber-500 hover:bg-amber-500">In prova</Badge>;
  if (sub.status === "canceled") return <Badge variant="destructive">Annullato</Badge>;
  return <Badge variant="outline">{sub.status}</Badge>;
}