import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { hashPin } from "@/hooks/useOperators";
import { toast } from "sonner";
import { UserPlus, UserCircle2, Trash2, KeyRound, Loader2, ListChecks, Sparkles, Thermometer, Pencil, Copy, AtSign } from "lucide-react";

type Op = { id: string; name: string; role: string | null; is_active: boolean; login_handle: string };
type Asset = { id: string; name: string; asset_type: string; cleaning_product: string | null };
type Assignment = {
  id: string;
  operator_id: string;
  asset_id: string;
  task_type: "sanitation" | "temperature";
  frequency: "daily" | "weekly" | "monthly";
};

const FREQ_LABEL = { daily: "Giornaliero", weekly: "Settimanale", monthly: "Mensile" } as const;

export default function OperatorsTab() {
  const [list, setList] = useState<Op[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // create dialog
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);

  // tasks dialog
  const [tasksFor, setTasksFor] = useState<Op | null>(null);

  // edit handle dialog
  const [editingHandle, setEditingHandle] = useState<Op | null>(null);
  const [handleDraft, setHandleDraft] = useState("");

  async function load() {
    const [ops, ass, ta] = await Promise.all([
      supabase.from("operators").select("id, name, role, is_active, login_handle").order("name"),
      supabase.from("assets").select("id, name, asset_type, cleaning_product").order("name"),
      supabase.from("task_assignments").select("*"),
    ]);
    setList((ops.data as Op[]) ?? []);
    setAssets((ass.data as Asset[]) ?? []);
    setAssignments((ta.data as Assignment[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return toast.error("Nome obbligatorio");
    if (pin.length < 4) return toast.error("PIN minimo 4 cifre");
    if (pin !== pin2) return toast.error("I PIN non coincidono");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      const pin_hash = await hashPin(pin, user.id);
      const { error } = await supabase.from("operators").insert({
        user_id: user.id,
        name: name.trim(),
        role: role.trim() || null,
        pin_hash,
        login_handle: "", // trigger fills automatically
      });
      if (error) throw error;
      toast.success("Operatore creato");
      setName(""); setRole(""); setPin(""); setPin2("");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminare l'operatore?")) return;
    await supabase.from("operators").delete().eq("id", id);
    load();
  }

  async function resetPin(op: Op) {
    const newPin = prompt(`Nuovo PIN per ${op.name} (min. 4 cifre):`);
    if (!newPin || newPin.length < 4) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const pin_hash = await hashPin(newPin, user.id);
    await supabase.from("operators").update({ pin_hash }).eq("id", op.id);
    toast.success("PIN aggiornato");
  }

  async function saveHandle() {
    if (!editingHandle) return;
    const v = handleDraft.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (v.length < 3) return toast.error("Min. 3 caratteri (lettere/numeri/trattini)");
    const { error } = await supabase.from("operators").update({ login_handle: v }).eq("id", editingHandle.id);
    if (error) {
      if (error.code === "23505") return toast.error("Nome utente già in uso");
      return toast.error(error.message);
    }
    toast.success("Nome utente aggiornato");
    setEditingHandle(null);
    load();
  }

  function copyHandle(handle: string) {
    navigator.clipboard.writeText(handle);
    toast.success("Copiato");
  }

  async function toggleAssignment(operatorId: string, assetId: string, taskType: "sanitation" | "temperature", checked: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (checked) {
      const { error } = await supabase.from("task_assignments").insert({
        user_id: user.id,
        operator_id: operatorId,
        asset_id: assetId,
        task_type: taskType,
        frequency: "daily",
      });
      if (error) return toast.error(error.message);
    } else {
      await supabase.from("task_assignments").delete()
        .eq("operator_id", operatorId).eq("asset_id", assetId).eq("task_type", taskType);
    }
    load();
  }

  async function setFrequency(assignmentId: string, frequency: "daily" | "weekly" | "monthly") {
    await supabase.from("task_assignments").update({ frequency }).eq("id", assignmentId);
    load();
  }

  function getAssignment(operatorId: string, assetId: string, taskType: "sanitation" | "temperature") {
    return assignments.find((a) => a.operator_id === operatorId && a.asset_id === assetId && a.task_type === taskType);
  }

  const fridgeAssets = assets.filter((a) => a.asset_type === "fridge" || a.asset_type === "freezer");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Operatori</h3>
          <p className="text-sm text-muted-foreground">Crea profili PIN e assegna le mansioni HACCP.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary gap-2"><UserPlus size={16} /> Nuovo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuovo operatore</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mario Rossi" />
              </div>
              <div className="space-y-1.5">
                <Label>Mansione</Label>
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Banco carni" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>PIN</Label>
                  <Input type="password" inputMode="numeric" maxLength={6} value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="text-center font-mono tracking-widest" />
                </div>
                <div className="space-y-1.5">
                  <Label>Conferma</Label>
                  <Input type="password" inputMode="numeric" maxLength={6} value={pin2}
                    onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
                    className="text-center font-mono tracking-widest" />
                </div>
              </div>
              <Button onClick={create} disabled={busy} className="w-full bg-gradient-primary">
                {busy ? <Loader2 className="animate-spin" size={16} /> : "Crea"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nessun operatore. Creane uno per iniziare a tracciare chi esegue le registrazioni.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((op) => {
            const opAssigns = assignments.filter((a) => a.operator_id === op.id);
            return (
              <Card key={op.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                    <UserCircle2 className="text-primary-foreground" size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{op.name}</div>
                    {op.role && <div className="text-xs text-muted-foreground truncate">{op.role}</div>}
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {opAssigns.length} {opAssigns.length === 1 ? "compito" : "compiti"} assegnati
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setTasksFor(op)} title="Mansioni">
                      <ListChecks size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => resetPin(op)} title="Reset PIN">
                      <KeyRound size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(op.id)} title="Elimina">
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <AtSign size={14} className="text-muted-foreground shrink-0" />
                  <code className="flex-1 text-xs font-mono bg-muted/60 rounded px-2 py-1 truncate">{op.login_handle}</code>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyHandle(op.login_handle)} title="Copia">
                    <Copy size={13} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingHandle(op); setHandleDraft(op.login_handle); }} title="Modifica">
                    <Pencil size={13} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tasks assignment dialog */}
      <Dialog open={!!tasksFor} onOpenChange={(v) => !v && setTasksFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks size={20} /> Mansioni di {tasksFor?.name}
            </DialogTitle>
          </DialogHeader>

          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nessuna attrezzatura in anagrafica. Aggiungile prima nella tab "Attrezzature".
            </p>
          ) : (
            <div className="space-y-6">
              {/* Sanitation */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-primary" />
                  <h4 className="font-semibold">Sanificazione</h4>
                </div>
                <div className="space-y-1.5">
                  {assets.map((a) => {
                    const ass = tasksFor && getAssignment(tasksFor.id, a.id, "sanitation");
                    return (
                      <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                        <Checkbox
                          id={`san-${a.id}`}
                          checked={!!ass}
                          onCheckedChange={(c) => tasksFor && toggleAssignment(tasksFor.id, a.id, "sanitation", !!c)}
                        />
                        <label htmlFor={`san-${a.id}`} className="flex-1 text-sm cursor-pointer">
                          {a.name}
                          {a.cleaning_product && <span className="text-muted-foreground ml-2 text-xs">· {a.cleaning_product}</span>}
                        </label>
                        {ass && (
                          <Select value={ass.frequency} onValueChange={(v: any) => setFrequency(ass.id, v)}>
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(FREQ_LABEL) as Array<keyof typeof FREQ_LABEL>).map((k) => (
                                <SelectItem key={k} value={k}>{FREQ_LABEL[k]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Temperature */}
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer size={16} className="text-primary" />
                  <h4 className="font-semibold">Rilevazione temperatura</h4>
                </div>
                {fridgeAssets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nessun frigo/congelatore in anagrafica.</p>
                ) : (
                  <div className="space-y-1.5">
                    {fridgeAssets.map((a) => {
                      const ass = tasksFor && getAssignment(tasksFor.id, a.id, "temperature");
                      return (
                        <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                          <Checkbox
                            id={`tmp-${a.id}`}
                            checked={!!ass}
                            onCheckedChange={(c) => tasksFor && toggleAssignment(tasksFor.id, a.id, "temperature", !!c)}
                          />
                          <label htmlFor={`tmp-${a.id}`} className="flex-1 text-sm cursor-pointer">{a.name}</label>
                          {ass && (
                            <Select value={ass.frequency} onValueChange={(v: any) => setFrequency(ass.id, v)}>
                              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(FREQ_LABEL) as Array<keyof typeof FREQ_LABEL>).map((k) => (
                                  <SelectItem key={k} value={k}>{FREQ_LABEL[k]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setTasksFor(null)} className="bg-gradient-primary">Fatto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit handle dialog */}
      <Dialog open={!!editingHandle} onOpenChange={(v) => !v && setEditingHandle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nome utente di {editingHandle?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome utente univoco</Label>
              <Input
                value={handleDraft}
                onChange={(e) => setHandleDraft(e.target.value)}
                placeholder="mario-bistrotdamario"
                className="font-mono"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                L'operatore lo userà per accedere dalla pagina di login. Solo lettere minuscole, numeri e trattini.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingHandle(null)}>Annulla</Button>
            <Button onClick={saveHandle} className="bg-gradient-primary">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}