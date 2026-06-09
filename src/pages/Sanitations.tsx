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
import { Sparkles, ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export default function Sanitations() {
  const { assets, refresh } = useAssets();
  const [assetId, setAssetId] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [productUsed, setProductUsed] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("sanitations")
      .select("*, assets(name)")
      .eq("event_date", eventDate)
      .order("event_date", { ascending: false })
      .limit(30);
    setRows(data ?? []);
    const { data: tasks } = await supabase
      .from("task_assignments")
      .select("asset_id, operator_id, operators(name)")
      .eq("user_id", user.id)
      .eq("task_type", "sanitation");
    setAssignments(tasks ?? []);
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
        {(() => {
          const doneAssetIds = new Set(rows.map((r) => r.asset_id));
          const assignedAssetIds = new Set(assignments.map((a) => a.asset_id));
          const notDone = assets.filter((a) => assignedAssetIds.has(a.id) && !doneAssetIds.has(a.id));
          const unassigned = assets.filter((a) => !assignedAssetIds.has(a.id) && !doneAssetIds.has(a.id));

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