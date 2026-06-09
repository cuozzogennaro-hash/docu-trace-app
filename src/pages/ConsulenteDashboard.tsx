import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Building2, ShieldCheck, AlertTriangle, Eye, Copy, FileDown, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import ConsulenteClientDetail from "./ConsulenteClientDetail";
import { generateClientHaccpReport } from "@/lib/consulenteReport";
import logoShield from "@/assets/logo-shield.png";

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
  const navigate = useNavigate();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(true);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  async function handleCopyCode() {
    if (!partner?.codice_partner) return;
    try {
      await navigator.clipboard.writeText(partner.codice_partner);
      toast.success("Codice copiato!");
    } catch {
      toast.error("Impossibile copiare il codice");
    }
  }

  async function handleDownloadReport(c: Cliente) {
    if (downloadingId) return;
    setDownloadingId(c.id);
    try {
      const res = await generateClientHaccpReport(c.id, c.business_name);
      toast.success(`Report scaricato (${res.totalRows} righe)`);
    } catch (err: any) {
      console.error("Report PDF error:", err);
      toast.error(err?.message || "Impossibile generare il report PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  if (selected) {
    return (
      <ConsulenteClientDetail
        clientId={selected.id}
        clientName={selected.business_name}
        onBack={() => setSelected(null)}
      />
    );
  }

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

      {/* Partner Code Card */}
      <Card className="mb-8 border border-primary/20 bg-primary/[0.03] shadow-soft">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Il tuo Codice Partner Esclusivo
            </p>
            {partnerLoading ? (
              <p className="text-sm text-muted-foreground italic">Caricamento…</p>
            ) : partner ? (
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {partner.codice_partner}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleCopyCode}
                >
                  <Copy size={14} />
                  Copia Codice
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Codice Partner in fase di generazione dall'amministratore
              </p>
            )}
          </div>
          {partner?.studio_name && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Studio
              </p>
              <p className="font-medium">{partner.studio_name}</p>
            </div>
          )}
        </div>
      </Card>

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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelected(c)}
                        >
                          <Eye size={14} className="mr-1.5" />
                          Visualizza
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleDownloadReport(c)}
                          disabled={downloadingId === c.id}
                        >
                          {downloadingId === c.id ? (
                            <>
                              <Loader2 size={14} className="mr-1.5 animate-spin" />
                              Generazione…
                            </>
                          ) : (
                            <>
                              <FileDown size={14} className="mr-1.5" />
                              Scarica PDF
                            </>
                          )}
                        </Button>
                      </div>
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
