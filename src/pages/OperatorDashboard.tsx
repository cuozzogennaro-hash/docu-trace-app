import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Sparkles, Thermometer, CheckCircle2, Loader2, Building2 } from "lucide-react";

type Asset = { id: string; name: string; asset_type: string; cleaning_product: string | null; target_temp_min: number | null; target_temp_max: number | null };
type Assignment = {
  id: string;
  asset_id: string;
  task_type: "sanitation" | "temperature";
  frequency: "daily" | "weekly" | "monthly";
  asset: Asset;
};

type CompanyInfo = { business_name: string | null; logo_url: string | null; address: string | null; vat: string | null };

export default function OperatorDashboard() {
  const { operator, signOut } = useOperatorSession();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  // Track completion: asset_id-task_type -> done? (in current period)
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [tempInputs, setTempInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!operator) return;
    setLoading(true);
    const [tasksRes, statusRes, companyRes] = await Promise.all([
      supabase.rpc("operator_tasks", { p_operator_id: operator.id }),
      supabase.rpc("operator_period_status", { p_operator_id: operator.id }),
      supabase.rpc("operator_company" as any, { p_operator_id: operator.id }),
    ]);
    const tasksPayload = tasksRes.data as { ok: boolean; tasks?: Assignment[] } | null;
    const statusPayload = statusRes.data as { ok: boolean; done?: Array<{ asset_id: string; task_type: string; done: boolean }> } | null;
    const companyPayload = companyRes.data as { ok: boolean; company?: CompanyInfo | null } | null;
    setAssignments(tasksPayload?.tasks ?? []);
    const map: Record<string, boolean> = {};
    (statusPayload?.done ?? []).forEach((d) => { map[`${d.asset_id}-${d.task_type}`] = !!d.done; });
    setDone(map);
    setCompany(companyPayload?.company ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [operator?.id]);

  if (!operator) return null;

  async function checkSanitation(a: Assignment) {
    if (!operator?.pin) return toast.error("Sessione scaduta, rifai login");
    setBusy(`s-${a.id}`);
    const { data, error } = await supabase.rpc("operator_record_sanitation", {
      p_operator_id: operator.id,
      p_pin: operator.pin,
      p_asset_id: a.asset_id,
    });
    setBusy(null);
    const res = data as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) return toast.error(res?.error === "pin" ? "PIN non valido" : "Errore");
    toast.success(`✓ ${a.asset.name} sanificato`);
    setDone((d) => ({ ...d, [`${a.asset_id}-sanitation`]: true }));
  }

  async function saveTemperature(a: Assignment) {
    if (!operator?.pin) return toast.error("Sessione scaduta, rifai login");
    const val = tempInputs[a.id];
    if (!val) return toast.error("Inserisci la temperatura");
    setBusy(`t-${a.id}`);
    const { data, error } = await supabase.rpc("operator_record_temperature", {
      p_operator_id: operator.id,
      p_pin: operator.pin,
      p_asset_id: a.asset_id,
      p_temperature: Number(val),
    });
    setBusy(null);
    const res = data as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) return toast.error(res?.error === "pin" ? "PIN non valido" : "Errore");
    toast.success(`✓ ${a.asset.name}: ${val}°C`);
    setDone((d) => ({ ...d, [`${a.asset_id}-temperature`]: true }));
    setTempInputs((t) => ({ ...t, [a.id]: "" }));
  }

  const sanitTasks = assignments.filter((a) => a.task_type === "sanitation");
  const tempTasks = assignments.filter((a) => a.task_type === "temperature");

  const remaining = assignments.filter((a) => !done[`${a.asset_id}-${a.task_type}`]).length;

  return (
    <>
      {company && (
        <div className="mb-6 rounded-xl bg-card border border-border p-4 flex items-center gap-4 shadow-soft">
          {company.logo_url ? (
            <img src={company.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-contain bg-muted" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Building2 className="text-primary-foreground" size={22} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold text-lg leading-tight truncate">{company.business_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[company.vat && `P.IVA ${company.vat}`, company.address].filter(Boolean).join(" • ") || ""}
            </div>
          </div>
        </div>
      )}
      <PageHeader
        title={`Ciao, ${operator.name}`}
        subtitle={remaining === 0 ? "Tutti i compiti di oggi completati 🎉" : `${remaining} compiti da completare`}
        action={
          <Button variant="ghost" onClick={signOut}>Esci</Button>
        }
      />

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>
      ) : assignments.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <p>Nessun compito assegnato.</p>
          <p className="text-xs mt-2">L'amministratore può assegnarti compiti dalla sezione Impostazioni → Operatori.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sanitTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="text-primary" size={18} />
                <h2 className="font-display font-bold text-lg">Sanificazioni</h2>
              </div>
              <div className="space-y-2">
                {sanitTasks.map((a) => {
                  const isDone = done[`${a.asset_id}-sanitation`];
                  return (
                    <Card key={a.id} className={`p-4 flex items-center gap-3 transition ${isDone ? "bg-success/5 border-success/30" : ""}`}>
                      <Checkbox
                        checked={!!isDone}
                        disabled={isDone || busy === `s-${a.id}`}
                        onCheckedChange={(c) => c && checkSanitation(a)}
                        className="h-6 w-6"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{a.asset.name}</div>
                        {a.asset.cleaning_product && (
                          <div className="text-xs text-muted-foreground truncate">🧴 {a.asset.cleaning_product}</div>
                        )}
                      </div>
                      {isDone && <CheckCircle2 className="text-success" size={20} />}
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {tempTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Thermometer className="text-primary" size={18} />
                <h2 className="font-display font-bold text-lg">Temperature</h2>
              </div>
              <div className="space-y-2">
                {tempTasks.map((a) => {
                  const isDone = done[`${a.asset_id}-temperature`];
                  return (
                    <Card key={a.id} className={`p-4 flex items-center gap-3 transition ${isDone ? "bg-success/5 border-success/30" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{a.asset.name}</div>
                        {(a.asset.target_temp_min != null || a.asset.target_temp_max != null) && (
                          <div className="text-xs text-muted-foreground">
                            range {a.asset.target_temp_min ?? "—"}° / {a.asset.target_temp_max ?? "—"}°
                          </div>
                        )}
                      </div>
                      {isDone ? (
                        <CheckCircle2 className="text-success" size={22} />
                      ) : (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="°C"
                            value={tempInputs[a.id] ?? ""}
                            onChange={(e) => setTempInputs((t) => ({ ...t, [a.id]: e.target.value }))}
                            className="w-24 text-center font-mono"
                          />
                          <Button
                            size="sm"
                            disabled={busy === `t-${a.id}` || !tempInputs[a.id]}
                            onClick={() => saveTemperature(a)}
                            className="bg-gradient-primary"
                          >
                            Salva
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}