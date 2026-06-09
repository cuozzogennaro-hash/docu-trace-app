import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Users, CheckCircle2, Clock, CreditCard, Activity, Eye, Smartphone, Handshake, UserPlus } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type Partner = {
  user_id: string;
  studio_name: string;
  codice_partner: string;
  created_at?: string | null;
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
  const [trafficDays, setTrafficDays] = useState<7 | 30 | 90>(7);
  const [traffic, setTraffic] = useState<any>(null);
  const [loadingTraffic, setLoadingTraffic] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [promoteUser, setPromoteUser] = useState<AdminUser | null>(null);
  const [studioName, setStudioName] = useState("");
  const [partnerCode, setPartnerCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function reloadAll() {
    setFetching(true);
    setLoadingPartners(true);
    const [overview, partnersRes] = await Promise.all([
      supabase.rpc("super_admin_overview" as any),
      supabase.from("consulenti_partner" as any).select("user_id, studio_name, codice_partner, created_at"),
    ]);
    if (!overview.error && overview.data && (overview.data as any).ok) {
      setUsers((overview.data as any).users || []);
    }
    if (!partnersRes.error) {
      setPartners(((partnersRes.data as any) || []) as Partner[]);
    }
    setFetching(false);
    setLoadingPartners(false);
  }

  useEffect(() => {
    if (!isSuperAdmin) return;
    reloadAll();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    (async () => {
      setLoadingTraffic(true);
      const { data } = await supabase.rpc("super_admin_traffic_overview" as any, { p_days: trafficDays });
      if (data && (data as any).ok) setTraffic(data);
      setLoadingTraffic(false);
    })();
  }, [isSuperAdmin, trafficDays]);

  if (loading) return <div className="p-8 text-muted-foreground">Caricamento…</div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const partnerIds = new Set(partners.map((p) => p.user_id));
  const partnerEmailByUid = new Map(users.map((u) => [u.id, u.email] as const));

  function openPromote(u: AdminUser) {
    setPromoteUser(u);
    const base = (u.business_name || u.email || "studio").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) || "STUDIO";
    setStudioName(u.business_name || "");
    setPartnerCode(`${base}10`);
  }

  async function savePromotion() {
    if (!promoteUser) return;
    const code = partnerCode.trim().toUpperCase();
    const studio = studioName.trim();
    if (!studio || !code) {
      toast.error("Compila Nome Studio e Codice Partner");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("super_admin_promote_partner" as any, {
      p_user_id: promoteUser.id,
      p_studio_name: studio,
      p_codice_partner: code,
    });
    setSaving(false);
    if (error || !data || !(data as any).ok) {
      const err = (data as any)?.error;
      if (err === "code_taken") toast.error("Codice Partner già in uso");
      else toast.error("Errore durante l'attivazione");
      return;
    }
    toast.success("Partner attivato con successo!");
    setPromoteUser(null);
    setStudioName("");
    setPartnerCode("");
    await reloadAll();
  }

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
          <h1 className="text-2xl font-display font-bold">Amministrazione Globale</h1>
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
                <th className="text-right px-3 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {fetching && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Caricamento…</td></tr>
              )}
              {!fetching && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nessun utente</td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{u.email || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.business_name || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.created_at)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.last_seen_at)}</td>
                  <td className="px-3 py-2"><StatusBadge sub={u.subscription} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(u.subscription?.current_period_end ?? null)}</td>
                  <td className="px-3 py-2 text-right">
                    {partnerIds.has(u.id) ? (
                      <Badge variant="outline" className="gap-1"><Handshake size={12} /> Partner</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => openPromote(u)} className="gap-1">
                        <UserPlus size={14} /> Rendi Partner
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Handshake size={18} className="text-primary" />
          </div>
          <h2 className="text-xl font-display font-semibold">Rete Consulenti Partner</h2>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Codice Partner</th>
                  <th className="text-left px-3 py-2">Nome Studio</th>
                  <th className="text-left px-3 py-2">Email Consulente</th>
                  <th className="text-left px-3 py-2">Attivato il</th>
                </tr>
              </thead>
              <tbody>
                {loadingPartners && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Caricamento…</td></tr>
                )}
                {!loadingPartners && partners.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nessun partner attivo</td></tr>
                )}
                {partners.map((p) => (
                  <tr key={p.user_id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono font-medium">{p.codice_partner}</td>
                    <td className="px-3 py-2">{p.studio_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{partnerEmailByUid.get(p.user_id) || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.created_at ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <TrafficSection
        traffic={traffic}
        loading={loadingTraffic}
        days={trafficDays}
        onChangeDays={setTrafficDays}
      />

      <Dialog open={!!promoteUser} onOpenChange={(o) => !o && setPromoteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rendi Partner</DialogTitle>
            <DialogDescription>
              {promoteUser?.email} — verrà aggiunto il ruolo "consulente" e creato il profilo partner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="studio">Nome Studio</Label>
              <Input id="studio" value={studioName} onChange={(e) => setStudioName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Codice Partner</Label>
              <Input id="code" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value.toUpperCase())} maxLength={40} className="font-mono" />
              <p className="text-xs text-muted-foreground">Es. NOMESTUDIO10 — deve essere univoco.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteUser(null)} disabled={saving}>Annulla</Button>
            <Button onClick={savePromotion} disabled={saving}>{saving ? "Salvataggio…" : "Salva"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function TrafficSection({
  traffic,
  loading,
  days,
  onChangeDays,
}: {
  traffic: any;
  loading: boolean;
  days: 7 | 30 | 90;
  onChangeDays: (d: 7 | 30 | 90) => void;
}) {
  const totals = traffic?.totals || { pageviews: 0, visitors: 0, native_share: 0 };
  const daily: Array<{ day: string; pageviews: number; visitors: number }> = traffic?.daily || [];
  const topPages: Array<{ label: string; views: number }> = traffic?.top_pages || [];
  const devices: Array<{ label: string; views: number }> = traffic?.devices || [];

  return (
    <section className="space-y-4 pt-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity size={18} className="text-primary" />
          </div>
          <h2 className="text-xl font-display font-semibold">Traffico app</h2>
        </div>
        <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => onChangeDays(d)}
              className={`px-3 py-1.5 ${days === d ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              aria-label={`Ultimi ${d} giorni`}
            >
              {d}g
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={Users} label="Visitatori unici" value={totals.visitors || 0} />
        <StatCard icon={Eye} label="Visualizzazioni" value={totals.pageviews || 0} />
        <StatCard icon={Smartphone} label="% da app nativa" value={totals.native_share || 0} />
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium mb-3">Andamento giornaliero</div>
        {loading ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Caricamento…</div>
        ) : daily.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Nessun dato nel periodo</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-pv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="pageviews" stroke="hsl(var(--primary))" fill="url(#grad-pv)" name="Visualizzazioni" />
                <Area type="monotone" dataKey="visitors" stroke="hsl(var(--muted-foreground))" fill="transparent" name="Visitatori" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Pagine più viste</div>
          {topPages.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nessun dato</div>
          ) : (
            <ul className="space-y-1.5">
              {topPages.map((p) => (
                <li key={p.label} className="flex items-center justify-between text-sm">
                  <span className="truncate text-muted-foreground">{p.label}</span>
                  <span className="font-medium tabular-nums ml-3">{p.views}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Dispositivi</div>
          {devices.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Nessun dato</div>
          ) : (
            <ul className="space-y-1.5">
              {devices.map((d) => (
                <li key={d.label} className="flex items-center justify-between text-sm capitalize">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium tabular-nums">{d.views}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  );
}