import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import AssetManager, { useAssets } from "@/components/AssetManager";
import OperatorPinDialog from "@/components/OperatorPinDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, PowerOff } from "lucide-react";
import AssetServiceDialog, { reactivateAsset } from "@/components/AssetServiceDialog";

function periodBounds(eventDate: string) {
  const ed = new Date(eventDate + "T00:00:00");
  const monthStart = new Date(ed.getFullYear(), ed.getMonth(), 1);
  const day = ed.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(ed);
  weekStart.setDate(ed.getDate() + diff);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { monthStart: fmt(monthStart), weekStart: fmt(weekStart), today: eventDate };
}

export default function Sanitations() {
  const { assets, refresh } = useAssets();
  const [assetId, setAssetId] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [productUsed, setProductUsed] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [periodRows, setPeriodRows] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { monthStart } = periodBounds(eventDate);
    const { data } = await supabase
      .from("sanitations")
      .select("*, assets(name)")
      .eq("event_date", eventDate)
      .order("event_date", { ascending: false })
      .limit(30);
    setRows(data ?? []);
    const { data: period } = await supabase
      .from("sanitations")
      .select("id, asset_id, event_date, operator, product_used, assets(name)")
      .gte("event_date", monthStart)
      .lte("event_date", eventDate)
      .order("event_date", { ascending: false });
    setPeriodRows(period ?? []);
    const { data: tasks } = await supabase
      .from("task_assignments")
      .select("asset_id, operator_id, frequency")
      .eq("user_id", user.id)
      .eq("task_type", "sanitation");
    const opIds = Array.from(new Set((tasks ?? []).map((t: any) => t.operator_id).filter(Boolean)));
    let opMap: Record<string, string> = {};
    if (opIds.length) {
      const { data: ops } = await supabase
        .from("operators")
        .select("id, name")
        .in("id", opIds);
      opMap = Object.fromEntries((ops ?? []).map((o: any) => [o.id, o.name]));
    }
    setAssignments((tasks ?? []).map((t: any) => ({ ...t, operators: { name: opMap[t.operator_id] } })));
  }
  useEffect(() => {
    load();
  }, [eventDate]);

  useEffect(() => {
    const onFocus = () => {
      load();
      refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventDate]);

  function handleSave() {
    if (!assetId) return toast.error("Seleziona un asset");
    setPinOpen(true);
  }

  async function saveWithOperator(op: { id: string; name: string }) {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("sanitations").insert({
      user_id: user!.id,
      asset_id: assetId,
      event_date: eventDate,
      operator: op.name,
      operator_id: op.id,
      product_used: productUsed,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Registrato da ${op.name}`);
    setProductUsed("");
    load();
  }

  return (
    <>
      <PageHeader
        title="Sanificazione"
        subtitle="Registra le operazioni di pulizia e sanificazione"
        action={<AssetManager onChange={refresh} />}
      />
      <Card className="p-5 shadow-soft mb-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Asset</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger><SelectValue placeholder="Seleziona attrezzatura" /></SelectTrigger>
              <SelectContent>
                {assets.filter((a: any) => !a.out_of_service).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Prodotto usato</Label>
            <Input value={productUsed} onChange={(e) => setProductUsed(e.target.value)} placeholder="Detergente/sanificante" />
          </div>
        </div>
        <Button onClick={handleSave} disabled={busy} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <ShieldCheck size={16} /> Identifica e registra
        </Button>
      </Card>

      <OperatorPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onConfirm={saveWithOperator}
        title="Chi sta registrando questa sanificazione?"
      />

      <div className="space-y-2">
        {(() => {
          const activeAssets = assets.filter((a: any) => !a.out_of_service);
          const outOfServiceAssets = assets.filter((a: any) => a.out_of_service);
          const { monthStart, weekStart } = periodBounds(eventDate);
          // Mappa per assegnazione → ultimo record nel periodo della sua frequenza
          const assignmentDone = new Map<string, any>();
          for (const a of assignments) {
            const start = a.frequency === "monthly" ? monthStart : a.frequency === "weekly" ? weekStart : eventDate;
            const rec = periodRows.find(
              (r) => r.asset_id === a.asset_id && r.event_date >= start && r.event_date <= eventDate,
            );
            if (rec) assignmentDone.set(a.asset_id, rec);
          }
          const todayIds = new Set(rows.map((r) => r.asset_id));
          // Cards verdi extra: assegnazioni completate nel periodo ma non oggi
          const extraDone = Array.from(assignmentDone.entries())
            .filter(([assetId, rec]) => !todayIds.has(assetId) && rec.event_date !== eventDate)
            .map(([, rec]) => rec);
          const assignedAssetIds = new Set(assignments.map((a) => a.asset_id));
          const notDone = activeAssets.filter(
            (a) => assignedAssetIds.has(a.id) && !todayIds.has(a.id) && !assignmentDone.has(a.id),
          );
          const unassigned = activeAssets.filter(
            (a) => !assignedAssetIds.has(a.id) && !todayIds.has(a.id),
          );

          return (
            <>
              {rows.map((r) => (
                <Card key={r.id} className="p-4 flex items-center justify-between border-l-4 border-l-green-500">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-green-600 shrink-0" size={20} />
                    <div>
                      <div className="font-semibold">{r.assets?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.event_date} • {r.operator || "—"} • <span className="text-green-700 font-medium">Effettuata</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{r.product_used}</div>
                </Card>
              ))}

              {extraDone.map((r) => (
                <Card key={`ex-${r.id}`} className="p-4 flex items-center justify-between border-l-4 border-l-green-500">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="text-green-600 shrink-0" size={20} />
                    <div>
                      <div className="font-semibold">{r.assets?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.event_date} • {r.operator || "—"} •{" "}
                        <span className="text-green-700 font-medium">Effettuata nel periodo</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{r.product_used}</div>
                </Card>
              ))}

              {notDone.map((a) => {
                const assign = assignments.find((x) => x.asset_id === a.id);
                return (
                  <Card
                    key={`nd-${a.id}`}
                    className="p-4 flex items-center justify-between border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className="text-red-600 shrink-0" size={20} />
                      <div>
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Assegnata a {assign?.operators?.name || "operatore"} •{" "}
                          <span className="text-red-700 font-medium">Non effettuata</span>
                        </div>
                      </div>
                    </div>
                    <AssetServiceDialog
                      assetId={a.id}
                      assetName={a.name}
                      area="pulizia"
                      onDone={() => { load(); refresh(); }}
                    />
                  </Card>
                );
              })}

              {unassigned.map((a) => (
                <Card
                  key={`ua-${a.id}`}
                  className="p-4 flex items-center justify-between border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-yellow-600 shrink-0" size={20} />
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-xs text-yellow-700 font-medium">Non assegnata</div>
                    </div>
                  </div>
                  <AssetServiceDialog
                    assetId={a.id}
                    assetName={a.name}
                    area="pulizia"
                    onDone={() => { load(); refresh(); }}
                  />
                </Card>
              ))}

              {outOfServiceAssets.map((a) => (
                <Card
                  key={`oos-${a.id}`}
                  className="p-4 flex items-center justify-between border-l-4 border-l-muted-foreground/50 bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <PowerOff className="text-muted-foreground shrink-0" size={20} />
                    <div>
                      <div className="font-semibold text-muted-foreground line-through">{a.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Fuori servizio
                        {(a as any).out_of_service_reason ? ` • ${(a as any).out_of_service_reason}` : ""}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => { if (await reactivateAsset(a.id)) { refresh(); load(); } }}
                  >
                    Rimetti in servizio
                  </Button>
                </Card>
              ))}

              {rows.length === 0 && notDone.length === 0 && unassigned.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nessun asset configurato.</p>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}