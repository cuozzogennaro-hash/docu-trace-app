import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { ArrowLeft, Thermometer, SprayCan, Lock } from "lucide-react";

type Props = {
  clientId: string;
  clientName: string | null;
  onBack: () => void;
};

type TempRow = {
  id: string;
  event_date: string;
  recorded_at: string;
  temperature: number;
  operator: string | null;
  asset_id: string;
};

type SanRow = {
  id: string;
  event_date: string;
  recorded_at: string;
  operator: string | null;
  product_used: string | null;
  asset_id: string;
};

type AssetMap = Record<string, string>;

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ConsulenteClientDetail({ clientId, clientName, onBack }: Props) {
  const [temps, setTemps] = useState<TempRow[]>([]);
  const [sans, setSans] = useState<SanRow[]>([]);
  const [assets, setAssets] = useState<AssetMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [tRes, sRes, aRes] = await Promise.all([
        supabase
          .from("temperatures")
          .select("id, event_date, recorded_at, temperature, operator, asset_id")
          .eq("user_id", clientId)
          .order("recorded_at", { ascending: false })
          .limit(200),
        supabase
          .from("sanitations")
          .select("id, event_date, recorded_at, operator, product_used, asset_id")
          .eq("user_id", clientId)
          .order("recorded_at", { ascending: false })
          .limit(200),
        supabase
          .from("assets")
          .select("id, name")
          .eq("user_id", clientId),
      ]);

      if (cancelled) return;

      if (tRes.error) console.error("temperatures:", tRes.error);
      if (sRes.error) console.error("sanitations:", sRes.error);
      if (aRes.error) console.error("assets:", aRes.error);

      const map: AssetMap = {};
      (aRes.data ?? []).forEach((a: { id: string; name: string }) => {
        map[a.id] = a.name;
      });

      setTemps((tRes.data as TempRow[]) ?? []);
      setSans((sRes.data as SanRow[]) ?? []);
      setAssets(map);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-2">
            <ArrowLeft size={16} className="mr-1.5" />
            Torna alla lista clienti
          </Button>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {clientName || "Cliente"}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
            <Lock size={13} />
            Vista di sola lettura — Supervisore HACCP
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-soft overflow-hidden">
        <Tabs defaultValue="temperatures" className="w-full">
          <div className="px-6 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="temperatures" className="gap-1.5">
                <Thermometer size={14} />
                Registro Temperature
              </TabsTrigger>
              <TabsTrigger value="sanitations" className="gap-1.5">
                <SprayCan size={14} />
                Registro Sanificazioni
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="temperatures" className="mt-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Caricamento…</div>
            ) : temps.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nessuna rilevazione di temperatura registrata.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ora rilevazione</TableHead>
                    <TableHead>Attrezzatura</TableHead>
                    <TableHead>Operatore</TableHead>
                    <TableHead className="text-right">Temperatura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {temps.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{fmtDate(t.event_date)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDateTime(t.recorded_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {assets[t.asset_id] || "—"}
                      </TableCell>
                      <TableCell>{t.operator || "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(t.temperature).toFixed(1)} °C
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="sanitations" className="mt-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Caricamento…</div>
            ) : sans.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nessuna sanificazione registrata.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ora registrazione</TableHead>
                    <TableHead>Attrezzatura / Area</TableHead>
                    <TableHead>Operatore</TableHead>
                    <TableHead>Prodotto utilizzato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sans.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{fmtDate(s.event_date)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDateTime(s.recorded_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {assets[s.asset_id] || "—"}
                      </TableCell>
                      <TableCell>{s.operator || "—"}</TableCell>
                      <TableCell>{s.product_used || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}