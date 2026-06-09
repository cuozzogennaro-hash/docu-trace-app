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
import { Thermometer, ShieldCheck, AlertTriangle, XCircle } from "lucide-react";

export default function Temperatures() {
  const { assets, refresh } = useAssets();
  // Solo attrezzature che richiedono rilevazione temperatura
  // (hanno almeno una soglia min/max impostata)
  const tempAssets = assets.filter(
    (a: any) => a.target_temp_min != null || a.target_temp_max != null,
  );
  const [assetId, setAssetId] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [temperature, setTemperature] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [pinOpen, setPinOpen] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("temperatures")
      .select("*, assets(name, target_temp_min, target_temp_max)")
      .eq("event_date", eventDate)
      .order("event_date", { ascending: false })
      .limit(30);
    setRows(data ?? []);
    const { data: tasks } = await supabase
      .from("task_assignments")
      .select("asset_id, operator_id, operators(name)")
      .eq("user_id", user.id)
      .eq("task_type", "temperature");
    setAssignments(tasks ?? []);
  }
  useEffect(() => {
    load();
  }, [eventDate]);

  function handleSave() {
    if (!assetId || !temperature) return toast.error("Asset e temperatura obbligatori");
    setPinOpen(true);
  }

  async function saveWithOperator(op: { id: string; name: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("temperatures").insert({
      user_id: user!.id,
      asset_id: assetId,
      event_date: eventDate,
      temperature: Number(temperature),
      operator: op.name,
      operator_id: op.id,
    });
    if (error) return toast.error(error.message);
    toast.success(`Registrato da ${op.name}`);
    setTemperature("");
    load();
  }

  return (
    <>
      <PageHeader
        title="Rilevazione Temperature"
        subtitle="Monitora la catena del freddo e le attrezzature"
        action={<AssetManager onChange={refresh} />}
      />
      <Card className="p-5 shadow-soft mb-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Asset</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger><SelectValue placeholder="Seleziona frigo/attrezzatura" /></SelectTrigger>
              <SelectContent>
                {tempAssets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Temperatura °C</Label>
            <Input type="number" step="0.1" inputMode="decimal" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </div>
        </div>
        <Button onClick={handleSave} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <ShieldCheck size={16} /> Identifica e registra
        </Button>
      </Card>

      <OperatorPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onConfirm={saveWithOperator}
        title="Chi sta registrando questa temperatura?"
      />

      <div className="space-y-2">
        {rows.map((r) => {
          const min = r.assets?.target_temp_min;
          const max = r.assets?.target_temp_max;
          const outOfRange =
            (min != null && r.temperature < min) || (max != null && r.temperature > max);
          return (
            <Card
              key={r.id}
              className={`p-4 flex items-center justify-between border-l-4 ${
                outOfRange ? "border-l-destructive" : "border-l-green-500"
              }`}
            >
              <div>
                <div className="font-semibold">{r.assets?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.event_date} • {r.operator || "—"} •{" "}
                  <span className={outOfRange ? "text-destructive font-medium" : "text-green-700 font-medium"}>
                    {outOfRange ? "Fuori range" : "Rilevata"}
                  </span>
                </div>
              </div>
              <div
                className={`font-display text-xl font-bold ${
                  outOfRange ? "text-destructive" : "text-success"
                }`}
              >
                {r.temperature}°C
              </div>
            </Card>
          );
        })}

        {(() => {
          const doneAssetIds = new Set(rows.map((r) => r.asset_id));
          const assignedAssetIds = new Set(assignments.map((a) => a.asset_id));
          const notDone = tempAssets.filter((a) => assignedAssetIds.has(a.id) && !doneAssetIds.has(a.id));
          const unassigned = tempAssets.filter((a) => !assignedAssetIds.has(a.id) && !doneAssetIds.has(a.id));

          return (
            <>
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
                          <span className="text-red-700 font-medium">Non rilevata</span>
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