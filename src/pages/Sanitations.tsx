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
import { Sparkles, ShieldCheck } from "lucide-react";

export default function Sanitations() {
  const { assets, refresh } = useAssets();
  const [assetId, setAssetId] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [productUsed, setProductUsed] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("sanitations")
      .select("*, assets(name)")
      .eq("event_date", eventDate)
      .order("event_date", { ascending: false })
      .limit(30);
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
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
                {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
        {rows.map((r) => (
          <Card key={r.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold">{r.assets?.name}</div>
              <div className="text-xs text-muted-foreground">{r.event_date} • {r.operator || "—"}</div>
            </div>
            <div className="text-sm text-muted-foreground">{r.product_used}</div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessuna sanificazione registrata.</p>}
      </div>
    </>
  );
}