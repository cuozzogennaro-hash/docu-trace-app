import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Repeat, ChefHat, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useDepartments } from "@/hooks/useDepartments";
import { useRecurringPreparations } from "@/hooks/useRecurringPreparations";

const CATEGORIES = [
  { value: "materia_prima", label: "Materia Prima" },
  { value: "aroma", label: "Aroma" },
  { value: "additivo_allergene", label: "Additivo" },
];

type Recurring = {
  id: string;
  product_name: string;
  supplier_name: string | null;
  category: string;
  department_id: string | null;
  quantity: string | null;
  origin: string | null;
  ingredients: string | null;
  born_in: string | null;
  raised_in: string | null;
  slaughtered_in: string | null;
  slaughter_mark: string | null;
  use_count: number;
  last_used_at: string | null;
};

const emptyForm = {
  product_name: "",
  supplier_name: "",
  category: "materia_prima",
  department_id: "",
  quantity: "",
  origin: "",
  ingredients: "",
  born_in: "",
  raised_in: "",
  slaughtered_in: "",
  slaughter_mark: "",
};

export default function RecurringTab() {
  const { departments } = useDepartments();
  const { rows: preparations, remove: removePreparation } = useRecurringPreparations();
  const [list, setList] = useState<Recurring[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const isMacelleria = (id: string) =>
    departments.find((d) => d.id === id)?.name?.toLowerCase().trim() === "macelleria";
  const isSalumeria = (id: string) =>
    (departments.find((d) => d.id === id)?.name?.toLowerCase().trim() ?? "").startsWith("salum");

  async function load() {
    const { data, error } = await (supabase as any)
      .from("recurring_raw_materials")
      .select("*")
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("product_name");
    if (error) return toast.error(error.message);
    setList((data as Recurring[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  function reset() {
    setEditing(null);
    setForm({ ...emptyForm });
  }

  function startEdit(item: Recurring) {
    setEditing(item);
    setForm({
      product_name: item.product_name,
      supplier_name: item.supplier_name ?? "",
      category: item.category,
      department_id: item.department_id ?? "",
      quantity: item.quantity ?? "",
      origin: item.origin ?? "",
      ingredients: item.ingredients ?? "",
      born_in: item.born_in ?? "",
      raised_in: item.raised_in ?? "",
      slaughtered_in: item.slaughtered_in ?? "",
      slaughter_mark: item.slaughter_mark ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.product_name.trim()) return toast.error("Nome obbligatorio");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      product_name: form.product_name.trim(),
      supplier_name: form.supplier_name.trim() || null,
      category: form.category,
      department_id: form.department_id || null,
      quantity: form.quantity.trim() || null,
      origin: form.origin.trim() || null,
      ingredients: form.ingredients.trim() || null,
      born_in: form.born_in.trim() || null,
      raised_in: form.raised_in.trim() || null,
      slaughtered_in: form.slaughtered_in.trim() || null,
      slaughter_mark: form.slaughter_mark.trim() || null,
    };
    const res = editing
      ? await (supabase as any).from("recurring_raw_materials").update(payload).eq("id", editing.id)
      : await (supabase as any).from("recurring_raw_materials").insert({ ...payload, user_id: user.id });
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Aggiornato" : "Aggiunto");
    setOpen(false);
    reset();
    load();
  }

  async function remove(item: Recurring) {
    if (!confirm(`Eliminare il prodotto ricorrente "${item.product_name}"?`)) return;
    const { error } = await (supabase as any).from("recurring_raw_materials").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato");
    load();
  }

  async function removePrep(id: string, name: string) {
    if (!confirm(`Eliminare la lavorazione ricorrente "${name}"?`)) return;
    try { await removePreparation(id); toast.success("Eliminata"); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Repeat size={18} /> Prodotti Ricorrenti
        </h3>
        <p className="text-sm text-muted-foreground">
          Modelli riutilizzabili. Le materie prime compaiono in <b>Ingresso Merci</b>, le lavorazioni in <b>Mise en place / Lavorazioni</b>.
        </p>
      </div>

      <Tabs defaultValue="raw" className="w-full">
        <TabsList>
          <TabsTrigger value="raw" className="gap-1.5"><Package size={14} /> Materie prime ({list.length})</TabsTrigger>
          <TabsTrigger value="prep" className="gap-1.5"><ChefHat size={14} /> Lavorazioni ({preparations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="raw" className="space-y-4 mt-4">
          <div className="flex items-center justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary gap-2"><Plus size={16} /> Nuovo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica" : "Nuovo"} prodotto ricorrente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome prodotto *</Label>
                <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} placeholder="Mozzarella fior di latte 250g" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fornitore</Label>
                  <Input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Quantità tipica</Label>
                  <Input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="5 kg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reparto</Label>
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona…" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Origine</Label>
                <Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Italia" />
              </div>
              {(form.category !== "materia_prima" || isSalumeria(form.department_id)) && (
                <div className="space-y-1.5">
                  <Label>Ingredienti</Label>
                  <Textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} rows={3} />
                </div>
              )}
              {isMacelleria(form.department_id) && (
                <div className="p-3 rounded-md bg-orange-50 border border-orange-200 space-y-2">
                  <Label className="text-xs font-semibold text-orange-900">Tracciabilità carne</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={form.born_in} onChange={(e) => setForm({ ...form, born_in: e.target.value })} placeholder="Nato in" />
                    <Input value={form.raised_in} onChange={(e) => setForm({ ...form, raised_in: e.target.value })} placeholder="Allevato in" />
                    <Input value={form.slaughtered_in} onChange={(e) => setForm({ ...form, slaughtered_in: e.target.value })} placeholder="Macellato in" />
                    <Input value={form.slaughter_mark} onChange={(e) => setForm({ ...form, slaughter_mark: e.target.value })} placeholder="Bollo CE" />
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
          Nessuna materia prima ricorrente. Aggiungine una o salvala dall'Ingresso Merci / Archivio.
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((item) => {
            const dept = departments.find((d) => d.id === item.department_id)?.name;
            return (
              <Card key={item.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{item.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.supplier_name || "—"}
                    {dept && <> • {dept}</>}
                    {item.use_count > 0 && <> • usato {item.use_count}×</>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => startEdit(item)}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(item)}><Trash2 size={16} className="text-destructive" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="prep" className="space-y-4 mt-4">
          <p className="text-xs text-muted-foreground">
            Le lavorazioni ricorrenti si creano dalla pagina <b>Mise en place / Lavorazioni</b> salvando una ricetta. Qui puoi consultarle ed eliminarle.
          </p>
          {preparations.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              Nessuna lavorazione ricorrente. Salvane una dalla pagina Lavorazioni.
            </Card>
          ) : (
            <div className="space-y-2">
              {preparations.map((p) => (
                <Card key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.storage_type} • conservazione {p.shelf_hours}h
                      {p.use_count > 0 && <> • usata {p.use_count}×</>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removePrep(p.id, p.name)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}