import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Refrigerator, Snowflake, Wrench, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import { useDepartments } from "@/hooks/useDepartments";

type Asset = {
  id: string;
  name: string;
  asset_type: string;
  cleaning_product: string | null;
  target_temp_min: number | null;
  target_temp_max: number | null;
  department_id: string | null;
};

const TYPE_META: Record<string, { label: string; icon: any }> = {
  fridge: { label: "Frigorifero", icon: Refrigerator },
  freezer: { label: "Congelatore", icon: Snowflake },
  equipment: { label: "Attrezzatura", icon: Wrench },
  surface: { label: "Superficie", icon: Layers },
};

export default function AssetsTab() {
  const [list, setList] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState({
    name: "",
    asset_type: "equipment",
    cleaning_product: "",
    target_temp_min: "",
    target_temp_max: "",
    department_id: "",
  });
  const { departments } = useDepartments();
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? null;

  async function load() {
    const { data } = await supabase
      .from("assets")
      .select("id, name, asset_type, cleaning_product, target_temp_min, target_temp_max, department_id")
      .order("name");
    setList((data as Asset[]) ?? []);

    // Load task assignments and operators separately (no FK)
    const { data: tasks } = await supabase
      .from("task_assignments")
      .select("asset_id, operator_id");
    const { data: ops } = await supabase
      .from("operators")
      .select("id, name");
    const opMap: Record<string, string> = {};
    for (const o of (ops ?? [])) opMap[o.id] = o.name;
    const map: Record<string, Set<string>> = {};
    for (const t of (tasks ?? []) as any[]) {
      const name = opMap[t.operator_id];
      if (!name || !t.asset_id) continue;
      (map[t.asset_id] ??= new Set()).add(name);
    }
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(map)) result[k] = [...v];
    setAssignments(result);
  }
  useEffect(() => { load(); }, []);

  function reset() {
    setEditing(null);
    setForm({ name: "", asset_type: "equipment", cleaning_product: "", target_temp_min: "", target_temp_max: "", department_id: "" });
  }

  function startEdit(a: Asset) {
    setEditing(a);
    setForm({
      name: a.name,
      asset_type: a.asset_type,
      cleaning_product: a.cleaning_product ?? "",
      target_temp_min: a.target_temp_min?.toString() ?? "",
      target_temp_max: a.target_temp_max?.toString() ?? "",
      department_id: a.department_id ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Nome obbligatorio");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      name: form.name.trim(),
      asset_type: form.asset_type,
      cleaning_product: form.cleaning_product.trim() || null,
      target_temp_min: form.target_temp_min ? Number(form.target_temp_min) : null,
      target_temp_max: form.target_temp_max ? Number(form.target_temp_max) : null,
      department_id: form.department_id || null,
    };
    const res = editing
      ? await supabase.from("assets").update(payload).eq("id", editing.id)
      : await supabase.from("assets").insert({ ...payload, user_id: user.id });
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Attrezzatura aggiornata" : "Attrezzatura aggiunta");
    setOpen(false);
    reset();
    load();
  }

  async function remove(a: Asset) {
    if (!confirm(`Eliminare "${a.name}"? Tutte le rilevazioni associate verranno mantenute ma orfane.`)) return;
    const { error } = await supabase.from("assets").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminata");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Anagrafica Attrezzature</h3>
          <p className="text-sm text-muted-foreground">Frigo, congelatori, affettatrici, banchi e superfici da monitorare.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary gap-2"><Plus size={16} /> Nuova</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica attrezzatura" : "Nuova attrezzatura"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Frigo cucina 1" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_META).map(([v, m]) => (
                      <SelectItem key={v} value={v}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reparto</Label>
                <Select
                  value={form.department_id || "__none__"}
                  onValueChange={(v) => setForm({ ...form, department_id: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Seleziona reparto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Senza reparto</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Detergente / Sanificante predefinito</Label>
                <Input
                  value={form.cleaning_product}
                  onChange={(e) => setForm({ ...form, cleaning_product: e.target.value })}
                  placeholder="es. Sgrassatore alimentare HACCP"
                />
                <p className="text-xs text-muted-foreground">Comparirà automaticamente all'operatore al momento della spunta.</p>
              </div>
              {(form.asset_type === "fridge" || form.asset_type === "freezer") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Temp. min °C</Label>
                    <Input type="number" step="0.1" value={form.target_temp_min} onChange={(e) => setForm({ ...form, target_temp_min: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Temp. max °C</Label>
                    <Input type="number" step="0.1" value={form.target_temp_max} onChange={(e) => setForm({ ...form, target_temp_max: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Annulla</Button>
              <Button onClick={save} className="bg-gradient-primary">Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nessuna attrezzatura. Aggiungi la prima per iniziare.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((a) => {
            const meta = TYPE_META[a.asset_type] ?? TYPE_META.equipment;
            const Icon = meta.icon;
            return (
              <Card key={a.id} className="p-4 flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                  <Icon className="text-primary-foreground" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {meta.label}
                    {deptName(a.department_id) && <> · <span className="text-foreground/70">{deptName(a.department_id)}</span></>}
                  </div>
                  {a.cleaning_product && (
                    <div className="text-xs mt-1 text-foreground/70 truncate">🧴 {a.cleaning_product}</div>
                  )}
                  {(a.target_temp_min != null || a.target_temp_max != null) && (
                    <div className="text-xs mt-0.5 text-foreground/70">
                      🌡 {a.target_temp_min ?? "—"}° / {a.target_temp_max ?? "—"}°
                    </div>
                  )}
                  <div className="text-xs mt-1 flex items-center gap-1 text-foreground/70">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${assignments[a.id]?.length ? "bg-green-500" : "bg-red-500"}`} />
                    {assignments[a.id]?.length
                      ? assignments[a.id].join(", ")
                      : <span className="italic text-muted-foreground">Non assegnato</span>
                    }
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(a)}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(a)}><Trash2 size={16} className="text-destructive" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}