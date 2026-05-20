import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import OperatorPinDialog from "@/components/OperatorPinDialog";
import { useAssets } from "@/components/AssetManager";
import { useHoldingRecords } from "@/hooks/useHoldingRecords";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Flame, ShieldCheck, Snowflake, RotateCw } from "lucide-react";
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
        {rows.map((r) => (
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
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessun controllo registrato.</p>}
      </div>
    </>
  );
}