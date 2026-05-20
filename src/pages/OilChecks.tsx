import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import OperatorPinDialog from "@/components/OperatorPinDialog";
import { useOilChecks } from "@/hooks/useOilChecks";
import { useAssets } from "@/components/AssetManager";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Droplets, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const POLAR_LIMIT = 25; // DM 28/06/1994

export default function OilChecks() {
  const { assets } = useAssets();
  const { rows, reload } = useOilChecks();
  const [fryerName, setFryerName] = useState("");
  const [assetId, setAssetId] = useState("");
  const [polar, setPolar] = useState("");
  const [action, setAction] = useState<"check" | "filter" | "change">("check");
  const [notes, setNotes] = useState("");
  const [pinOpen, setPinOpen] = useState(false);

  function handleSave() {
    if (!fryerName && !assetId) return toast.error("Indica friggitrice o attrezzatura");
    setPinOpen(true);
  }

  async function saveWith(op: { id: string; name: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessione scaduta");
    const p = polar ? Number(polar) : null;
    const outcome: "ok" | "anomaly" = p != null && p >= POLAR_LIMIT ? "anomaly" : "ok";
    const { error } = await supabase.from("oil_checks" as any).insert({
      user_id: user.id,
      operator_id: op.id,
      asset_id: assetId || null,
      fryer_name: fryerName || null,
      polar_compounds: p,
      action,
      outcome,
      notes: notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success(outcome === "ok" ? `Registrato (${op.name})` : "Olio oltre il limite — cambia subito");
    setFryerName(""); setPolar(""); setNotes(""); setAction("check");
    reload();
  }

  return (
    <>
      <PageHeader title="Controllo olio frittura" subtitle={`Limite legale composti polari: ${POLAR_LIMIT}% (DM 28/06/1994)`} />
      <Card className="p-5 shadow-soft mb-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Friggitrice</Label>
            <Input value={fryerName} onChange={(e) => setFryerName(e.target.value)} placeholder="Es. Friggitrice 1" />
          </div>
          <div className="space-y-2">
            <Label>Attrezzatura registrata</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
              <SelectContent>
                {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><AlertTriangle size={12} /> Composti polari %</Label>
            <Input type="number" step="0.1" value={polar} onChange={(e) => setPolar(e.target.value)} placeholder="es. 18" />
            <p className="text-xs text-muted-foreground">Se ≥ {POLAR_LIMIT}% l'olio va sostituito immediatamente.</p>
          </div>
          <div className="space-y-2">
            <Label>Azione eseguita</Label>
            <Select value={action} onValueChange={(v: any) => setAction(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="check">Solo controllo</SelectItem>
                <SelectItem value="filter">Filtraggio</SelectItem>
                <SelectItem value="change">Cambio olio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Note</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Es. odore, colore, schiuma" />
          </div>
        </div>
        <Button onClick={handleSave} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <ShieldCheck size={16} /> Identifica e registra
        </Button>
      </Card>

      <OperatorPinDialog open={pinOpen} onOpenChange={setPinOpen} onConfirm={saveWith} title="Chi ha eseguito il controllo olio?" />

      <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Droplets size={16} /> Ultimi controlli</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.fryer_name || "Friggitrice"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(r.checked_at).toLocaleString("it-IT")}
                  {r.polar_compounds != null && ` • Composti polari ${r.polar_compounds}%`}
                </div>
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  <Badge variant="outline">{r.action === "check" ? "Controllo" : r.action === "filter" ? "Filtraggio" : "Cambio olio"}</Badge>
                  <Badge variant={r.outcome === "ok" ? "secondary" : "destructive"}>
                    {r.outcome === "ok" ? "Conforme" : "Oltre limite"}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessun controllo registrato.</p>}
      </div>
    </>
  );
}