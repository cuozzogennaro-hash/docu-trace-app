import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { useAssets } from "@/components/AssetManager";
import OperatorPinDialog from "@/components/OperatorPinDialog";
import PrintLabelDialog from "@/components/kitchen/PrintLabelDialog";
import { useBlastChillings, type BlastChilling } from "@/hooks/useBlastChillings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Snowflake, Printer, ShieldCheck, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function BlastChillings() {
  const { assets } = useAssets();
  const blastChillers = useMemo(
    () => assets.filter((a) => a.asset_type === "blast_chiller" || a.asset_type === "freezer" || a.asset_type === "equipment"),
    [assets]
  );
  const { rows, reload } = useBlastChillings();

  const [productName, setProductName] = useState("");
  const [assetId, setAssetId] = useState("");
  const [cycleType, setCycleType] = useState<"positive" | "negative">("positive");
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");
  const [startedAt, setStartedAt] = useState(nowLocal());
  const [endedAt, setEndedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [printItem, setPrintItem] = useState<BlastChilling | null>(null);

  function reset() {
    setProductName(""); setTempStart(""); setTempEnd(""); setEndedAt(""); setNotes("");
    setStartedAt(nowLocal());
  }

  function handleSave() {
    if (!productName) return toast.error("Indica il nome del prodotto");
    setPinOpen(true);
  }

  async function saveWithOperator(op: { id: string; name: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessione scaduta");
    const targetTemp = cycleType === "positive" ? 3 : -18;
    const outcome = tempEnd && Number(tempEnd) > targetTemp + 1 ? "anomaly" : "ok";
    const { error } = await supabase.from("blast_chillings" as any).insert({
      user_id: user.id,
      operator_id: op.id,
      asset_id: assetId || null,
      product_name: productName,
      cycle_type: cycleType,
      temp_start: tempStart ? Number(tempStart) : null,
      temp_end: tempEnd ? Number(tempEnd) : null,
      started_at: new Date(startedAt).toISOString(),
      ended_at: endedAt ? new Date(endedAt).toISOString() : null,
      outcome,
      notes: notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`Abbattimento registrato da ${op.name}`);
    reset();
    reload();
  }

  return (
    <>
      <PageHeader title="Abbattimenti" subtitle="Registro cicli di abbattimento positivo/negativo (HACCP)" />

      <Card className="p-5 shadow-soft mb-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Prodotto / preparazione</Label>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Es. Petto pollo cotto, salsa carbonara" />
          </div>
          <div className="space-y-2">
            <Label>Tipo ciclo</Label>
            <Select value={cycleType} onValueChange={(v: any) => setCycleType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="positive">Positivo (+3°C entro 90')</SelectItem>
                <SelectItem value="negative">Negativo (-18°C entro 4h)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Abbattitore</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger><SelectValue placeholder="Seleziona attrezzatura" /></SelectTrigger>
              <SelectContent>
                {blastChillers.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Aggiungi un abbattitore da Temperature → Nuovo asset</div>}
                {blastChillers.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Temp. inizio °C</Label>
            <Input type="number" step="0.1" value={tempStart} onChange={(e) => setTempStart(e.target.value)} placeholder="es. 75" />
          </div>
          <div className="space-y-2">
            <Label>Temp. fine °C</Label>
            <Input type="number" step="0.1" value={tempEnd} onChange={(e) => setTempEnd(e.target.value)} placeholder={cycleType === "positive" ? "es. 3" : "es. -18"} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Play size={12} /> Inizio</Label>
            <Input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Square size={12} /> Fine</Label>
            <Input type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Note</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Eventuali anomalie o osservazioni" />
          </div>
        </div>
        <Button onClick={handleSave} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <ShieldCheck size={16} /> Identifica e registra
        </Button>
      </Card>

      <OperatorPinDialog open={pinOpen} onOpenChange={setPinOpen} onConfirm={saveWithOperator} title="Chi ha eseguito l'abbattimento?" />

      <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Snowflake size={16} /> Ultimi abbattimenti</h3>
      <div className="space-y-2">
        {rows.map((r) => {
          const duration = r.ended_at ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000) : null;
          return (
            <Card key={r.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.product_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(r.started_at).toLocaleString("it-IT")}
                  {duration != null && ` • ${duration} min`}
                  {r.temp_start != null && ` • ${r.temp_start}°C → ${r.temp_end ?? "—"}°C`}
                </div>
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  <Badge variant={r.cycle_type === "positive" ? "secondary" : "default"}>
                    {r.cycle_type === "positive" ? "Positivo +3°C" : "Negativo -18°C"}
                  </Badge>
                  <Badge variant={r.outcome === "ok" ? "outline" : "destructive"}>
                    {r.outcome === "ok" ? "Conforme" : "Anomalia"}
                  </Badge>
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setPrintItem(r)}>
                <Printer size={14} /> Etichetta
              </Button>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessun abbattimento registrato.</p>}
      </div>

      {printItem && (
        <PrintLabelDialog
          open={!!printItem}
          onOpenChange={(v) => !v && setPrintItem(null)}
          title="Etichetta abbattimento"
          productName={printItem.product_name}
          fields={[
            { label: "Ciclo", value: printItem.cycle_type === "positive" ? "Positivo (+3°C)" : "Negativo (-18°C)" },
            { label: "Inizio", value: new Date(printItem.started_at).toLocaleString("it-IT") },
            ...(printItem.ended_at ? [{ label: "Fine", value: new Date(printItem.ended_at).toLocaleString("it-IT") }] : []),
            ...(printItem.temp_start != null ? [{ label: "Temp. inizio", value: `${printItem.temp_start}°C` }] : []),
            ...(printItem.temp_end != null ? [{ label: "Temp. fine", value: `${printItem.temp_end}°C` }] : []),
            { label: "Esito", value: printItem.outcome === "ok" ? "Conforme" : "Anomalia" },
          ]}
        />
      )}
    </>
  );
}