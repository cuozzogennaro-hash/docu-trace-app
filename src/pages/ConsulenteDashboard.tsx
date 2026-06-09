import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Building2, ShieldCheck, AlertTriangle, Eye, Copy } from "lucide-react";
import { toast } from "sonner";

type Cliente = {
  id: string;
  business_name: string | null;
  email: string | null;
  last_seen_at: string | null;
};

type Status = "green" | "yellow" | "red";

function getStatus(lastSeen: string | null): Status {
  if (!lastSeen) return "red";
  const hours = (Date.now() - new Date(lastSeen).getTime()) / 36e5;
  if (hours <= 24) return "green";
  if (hours <= 72) return "yellow";
  return "red";
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return "Mai";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `Oggi alle ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Ieri alle ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
  }
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 36e5;
  if (diffH < 48) {
    return `${Math.floor(diffH)} ore fa`;
  }
  const diffD = Math.floor(diffH / 24);
  return `${diffD} giorni fa`;
}

const STATUS_META: Record<
  Status,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; classes: string }
> = {
  green: {
    label: "Attivo",
    variant: "default",
    classes: "bg-emerald-500 hover:bg-emerald-600 text-white",
  },
  yellow: {
    label: "Avviso",
    variant: "default",
    classes: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  red: {
    label: "Allarme",
    variant: "default",
    classes: "bg-rose-500 hover:bg-rose-600 text-white",
  },
};

type PartnerData = {
  codice_partner: string;
  studio_name: string | null;
};

export default function ConsulenteDashboard() {
  const { user } = useAuth();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, business_name, email, last_seen_at")
        .eq("consulente_id", user.id)
        .order("business_name", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("Errore caricamento clienti consulente:", error);
        setClienti([]);
      } else {
        setClienti((data as Cliente[]) ?? []);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadPartner() {
      const { data, error } = await supabase
        .from("consulenti_partner")
        .select("codice_partner, studio_name")
        .eq("user_id", user.id)
        .single();

      if (cancelled) return;
      if (!error && data) {
        setPartner(data as PartnerData);
      }
      setPartnerLoading(false);
    }

    loadPartner();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const counts = useMemo(() => {
    const total = clienti.length;
    const green = clienti.filter((c) => getStatus(c.last_seen_at) === "green").length;
    const yellow = clienti.filter((c) => getStatus(c.last_seen_at) === "yellow").length;
    const red = clienti.filter((c) => getStatus(c.last_seen_at) === "red").length;
    return { total, green, yellow, red, warning: yellow + red };
  }, [clienti]);

  const kpis = useMemo(
    () => [
      {
        label: "Totale Aziende Assistite",
        value: counts.total,
        icon: Building2,
        tone: "from-sky-500 to-cyan-500",
      },
      {
        label: "In Regola",
        value: counts.green,
        icon: ShieldCheck,
        tone: "from-emerald-500 to-teal-500",
      },
      {
        label: "In Attenzione / Allarme",
        value: counts.warning,
        icon: AlertTriangle,
        tone: counts.warning > 0 ? "from-rose-500 to-red-500" : "from-amber-500 to-orange-500",
      },
    ],
    [counts]
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Pannello di Controllo Supervisor
        </h1>
        <p className="text-muted-foreground mt-1">
          Sicurezza Alimentare — Monitoraggio dei clienti assegnati
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {kpis.map((k) => (
          <Card
            key={k.label}
            className="relative overflow-hidden p-5 border-0 shadow-soft"
          >
            <div
              className={`absolute inset-0 opacity-[0.07] bg-gradient-to-br ${k.tone}`}
            />
            <div className="relative flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-xl bg-gradient-to-br ${k.tone} flex items-center justify-center shadow-md`}
              >
                <k.icon className="text-white" size={22} />
              </div>
              <div>
                <div className="font-display text-3xl font-bold tracking-tight">
                  {k.value}
                </div>
                <div className="text-sm font-medium text-foreground/80">
                  {k.label}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabella Clienti */}
      <Card className="border-0 shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-display text-lg font-semibold">
            Elenco Aziende Assistite
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Caricamento clienti…
          </div>
        ) : clienti.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nessun cliente associato al tuo studio.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ragione Sociale</TableHead>
                <TableHead>Email di riferimento</TableHead>
                <TableHead>Ultimo Accesso</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clienti.map((c) => {
                const status = getStatus(c.last_seen_at);
                const meta = STATUS_META[status];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.business_name || "—"}
                    </TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatLastSeen(c.last_seen_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant} className={meta.classes}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          console.log("Visualizza Registri", c.id, c.business_name)
                        }
                      >
                        <Eye size={14} className="mr-1.5" />
                        Visualizza Registri
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
