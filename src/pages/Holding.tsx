import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import OperatorPinDialog from "@/components/OperatorPinDialog";
import { useAssets } from "@/components/AssetManager";
import { useHoldingRecords, type HoldingRecord } from "@/hooks/useHoldingRecords";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Flame, ShieldCheck, Snowflake, RotateCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const MODE_LABEL: Record<string, string> = {
  hot: "Mantenimento caldo (≥60°C)",
  cold: "Mantenimento freddo (≤4°C)",
  regeneration: "Rigenerazione (≥70°C al cuore)",
};

function evalOutcome(mode: string, t: number | null): "ok" | "anomaly" {
  if (t == null || isNaN(t)) return "ok";
  if (mode === "hot" && t < 60) return "anomaly";
  if (mode === "cold" && t > 4) return "anomaly";
  if (mode === "regeneration" && t < 70) return "anomaly";
  return "ok";
}

export default function Holding() {
  const { assets } = useAssets();
  const { rows, reload } = useHoldingRecords();
  const [productName, setProductName] = useState("");
  const [mode, setMode] = useState<"hot" | "cold" | "regeneration">("hot");
  const [assetId, setAssetId] = useState("");
  const [temperature, setTemperature] = useState("");
  const [notes, setNotes] = useState("");
  const [pinOpen, setPinOpen] = useState(false);

  // Completamento di una scheda pending (creata automaticamente da Cucina/Abbattimento)
  const [completeItem, setCompleteItem] = useState<HoldingRecord | null>(null);
  const [completeMode, setCompleteMode] = useState<"hot" | "cold" | "regeneration">("hot");
  const [completeAssetId, setCompleteAssetId] = useState("");
  const [completeTemp, setCompleteTemp] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const [completePinOpen, setCompletePinOpen] = useState(false);

  const pendingRows = useMemo(() => rows.filter((r) => r.outcome === "pending"), [rows]);
  const doneRows = useMemo(() => rows.filter((r) => r.outcome !== "pending"), [rows]);

  function openComplete(item: HoldingRecord) {
    setCompleteItem(item);
    setCompleteMode(item.mode);
    setCompleteAssetId(item.asset_id ?? "");
    setCompleteTemp("");
    setCompleteNotes(item.notes ?? "");
  }

  async function confirmComplete(op: { id: string; name: string }) {
    if (!completeItem) return;
    if (!completeTemp) return toast.error("Indica la temperatura");
    const t = Number(completeTemp);
    const outcome = evalOutcome(completeMode, t);
    const cleanedNotes = (completeNotes || "").replace(/^Da completare\s*[—-]?\s*/i, "").trim() || null;
    const { error } = await (supabase as any)
      .from("holding_records")
      .update({
        operator_id: op.id,
        asset_id: completeAssetId || null,
        mode: completeMode,
        temperature: t,
        outcome,
        notes: cleanedNotes,
        recorded_at: new Date().toISOString(),
      })
      .eq("id", completeItem.id);
    if (error) return toast.error(error.message);
    toast.success(outcome === "ok" ? `Mantenimento registrato (${op.name})` : `Anomalia registrata — attiva azione correttiva`);
    setCompleteItem(null);
    reload();
  }

  const filteredAssets = useMemo(() => assets, [assets]);

  function handleSave() {
    if (!productName) return toast.error("Indica nome prodotto");
    if (!temperature) return toast.error("Indica temperatura");
    setPinOpen(true);
  }

  async function saveWith(op: { id: string; name: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessione scaduta");
    const t = Number(temperature);
    const outcome = evalOutcome(mode, t);
    const { error } = await supabase.from("holding_records" as any).insert({
      user_id: user.id,
      operator_id: op.id,
      asset_id: assetId || null,
      product_name: productName,
      mode,
      temperature: t,
      outcome,
      notes: notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success(outcome === "ok" ? `Registrato (${op.name})` : `Anomalia registrata — attiva azione correttiva`);
    setProductName(""); setTemperature(""); setNotes("");
    reload();
  }

  const ModeIcon = mode === "cold" ? Snowflake : mode === "regeneration" ? RotateCw : Flame;

  return (
    <>
      <PageHeader title="Mantenimento & Rigenerazione" subtitle="Caldo ≥60°C, Freddo ≤4°C, Rigenerazione ≥70°C al cuore (HACCP)" />

      {pendingRows.length > 0 && (
        <Card className="p-5 shadow-soft mb-6 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-amber-600" />
            <h3 className="font-display font-bold">Schede da completare ({pendingRows.length})</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Schede aperte automaticamente da Cucina o Abbattimento. Inserisci temperatura e operatore per chiudere la rilevazione.
          </p>
          <div className="space-y-2">
            {pendingRows.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-background border">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.product_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Aperto: {new Date(r.created_at).toLocaleString("it-IT")}
                    {r.notes && ` • ${r.notes}`}
                  </div>
                  <Badge variant="secondary" className="mt-2">{MODE_LABEL[r.mode]}</Badge>
                </div>
                <Button size="sm" className="gap-1.5 bg-gradient-primary shrink-0" onClick={() => openComplete(r)}>
                  <CheckCircle2 size={14} /> Completa
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5 shadow-soft mb-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Prodotto / piatto</Label>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Es. Lasagne, brodo, insalata di riso" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><ModeIcon size={12} /> Tipo controllo</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hot">Mantenimento caldo (≥60°C)</SelectItem>
                <SelectItem value="cold">Mantenimento freddo (≤4°C)</SelectItem>
                <SelectItem value="regeneration">Rigenerazione (≥70°C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Attrezzatura</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
              <SelectContent>
                {filteredAssets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Temperatura rilevata °C</Label>
            <Input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder={mode === "cold" ? "es. 3" : mode === "regeneration" ? "es. 75" : "es. 65"} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Note</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Eventuali osservazioni" />
          </div>
        </div>
        <Button onClick={handleSave} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <ShieldCheck size={16} /> Identifica e registra
        </Button>
      </Card>

      <OperatorPinDialog open={pinOpen} onOpenChange={setPinOpen} onConfirm={saveWith} title="Chi ha eseguito il controllo?" />

      <h3 className="font-display font-semibold mb-3">Ultimi controlli</h3>
      <div className="space-y-2">
        {doneRows.map((r) => (
          <Card key={r.id} className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">{r.product_name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(r.recorded_at).toLocaleString("it-IT")} • {r.temperature != null ? `${r.temperature}°C` : "—"}
              </div>
              <div className="mt-2 flex gap-1.5 flex-wrap">
                <Badge variant="outline">{MODE_LABEL[r.mode]}</Badge>
                <Badge variant={r.outcome === "ok" ? "secondary" : "destructive"}>
                  {r.outcome === "ok" ? "Conforme" : "Anomalia"}
                </Badge>
              </div>
            </div>
          </Card>
        ))}
        {doneRows.length === 0 && pendingRows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessun controllo registrato.</p>}
      </div>

      <AlertDialog open={!!completeItem} onOpenChange={(v) => !v && setCompleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Completa rilevazione</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {completeItem && (
                  <div className="mb-3"><strong>{completeItem.product_name}</strong></div>
                )}
                <div className="space-y-3 mt-2">
                  <div className="space-y-1.5">
                    <Label>Tipo controllo</Label>
                    <Select value={completeMode} onValueChange={(v: any) => setCompleteMode(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hot">Mantenimento caldo (≥60°C)</SelectItem>
                        <SelectItem value="cold">Mantenimento freddo (≤4°C)</SelectItem>
                        <SelectItem value="regeneration">Rigenerazione (≥70°C)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Attrezzatura</Label>
                    <Select value={completeAssetId} onValueChange={setCompleteAssetId}>
                      <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
                      <SelectContent>
                        {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Temperatura rilevata °C</Label>
                    <Input type="number" step="0.1" value={completeTemp} onChange={(e) => setCompleteTemp(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note</Label>
                    <Textarea rows={2} value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} />
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); setCompletePinOpen(true); }}
              className="bg-gradient-primary"
            >
              Identifica e chiudi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OperatorPinDialog open={completePinOpen} onOpenChange={setCompletePinOpen} onConfirm={confirmComplete} title="Chi ha completato la rilevazione?" />
    </>
  );
}