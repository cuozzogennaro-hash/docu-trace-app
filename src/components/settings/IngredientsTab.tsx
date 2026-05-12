import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generateInternalLot } from "@/lib/lot";

type Item = {
  id: string;
  product_name: string;
  supplier_name: string | null;
  supplier_lot: string | null;
  internal_lot: string;
  quantity: string | null;
  expiry_date: string | null;
  origin: string | null;
  is_out_of_stock: boolean;
  document_date: string | null;
  ingredients: string | null;
};

interface Props {
  category: string;
  title: string;
  subtitle: string;
}

export default function IngredientsTab({ category, title, subtitle }: Props) {
  const [list, setList] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState({
    product_name: "",
    supplier_name: "",
    supplier_lot: "",
    internal_lot: generateInternalLot("L"),
    quantity: "",
    expiry_date: "",
    origin: "",
    document_date: "",
    ingredients: "",
  });

  async function load() {
    const { data } = await supabase
      .from("raw_materials")
      .select("id, product_name, supplier_name, supplier_lot, internal_lot, quantity, expiry_date, origin, is_out_of_stock, document_date, ingredients")
      .eq("category", category)
      .order("product_name");
    setList((data as Item[]) ?? []);
  }
  useEffect(() => { load(); }, [category]);

  function reset() {
    setEditing(null);
    setForm({ product_name: "", supplier_name: "", supplier_lot: "", internal_lot: generateInternalLot("L"), quantity: "", expiry_date: "", origin: "", document_date: "", ingredients: "" });
  }

  function startEdit(item: Item) {
    setEditing(item);
    setForm({
      product_name: item.product_name,
      supplier_name: item.supplier_name ?? "",
      supplier_lot: item.supplier_lot ?? "",
      internal_lot: item.internal_lot,
      quantity: item.quantity ?? "",
      expiry_date: item.expiry_date ?? "",
      origin: item.origin ?? "",
      document_date: item.document_date ?? "",
      ingredients: item.ingredients ?? "",
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
      supplier_lot: form.supplier_lot.trim() || null,
      internal_lot: form.internal_lot,
      quantity: form.quantity.trim() || null,
      expiry_date: form.expiry_date || null,
      origin: form.origin.trim() || null,
      document_date: form.document_date || null,
      ingredients: form.ingredients.trim() || null,
    };
    const res = editing
      ? await supabase.from("raw_materials").update(payload).eq("id", editing.id)
      : await supabase.from("raw_materials").insert({ ...payload, user_id: user.id, category });
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Aggiornato" : "Aggiunto");
    setOpen(false);
    reset();
    load();
  }

  async function remove(item: Item) {
    if (!confirm(`Eliminare "${item.product_name}"?`)) return;
    const { error } = await supabase.from("raw_materials").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato");
    load();
  }

  async function toggleStock(id: string, value: boolean) {
    await supabase.from("raw_materials").update({ is_out_of_stock: value }).eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary gap-2"><Plus size={16} /> Nuovo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica" : "Aggiungi"} {title.toLowerCase()}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} placeholder="Nome prodotto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fornitore</Label>
                  <Input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data acquisto</Label>
                  <Input type="date" value={form.document_date} onChange={(e) => setForm({ ...form, document_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Lotto fornitore</Label>
                  <Input value={form.supplier_lot} onChange={(e) => setForm({ ...form, supplier_lot: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Lotto interno</Label>
                  <Input value={form.internal_lot} readOnly className="font-mono bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quantità</Label>
                  <Input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="100 g" />
                </div>
                <div className="space-y-1.5">
                  <Label>Scadenza</Label>
                  <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Provenienza / Origine</Label>
                <Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
              </div>
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
          Nessun elemento. Aggiungi il primo per iniziare.
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((item) => (
            <Card key={item.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{item.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.supplier_name || "—"} • <span className="font-mono">{item.internal_lot}</span>
                  {item.expiry_date && <> • Scad: {item.expiry_date}</>}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                <Checkbox checked={item.is_out_of_stock} onCheckedChange={(v) => toggleStock(item.id, Boolean(v))} />
                Esaurito
              </label>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => startEdit(item)}><Pencil size={16} /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(item)}><Trash2 size={16} className="text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}