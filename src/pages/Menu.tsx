import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { useMenuDishes, type MenuDish } from "@/hooks/useMenuDishes";
import { useAllergens } from "@/hooks/useAllergens";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Printer, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

export default function Menu() {
  const { rows, reload } = useMenuDishes();
  const { allergens } = useAllergens();
  const [editing, setEditing] = useState<MenuDish | null>(null);
  const [open, setOpen] = useState(false);

  const allergenMap = useMemo(() => new Map(allergens.map((a) => [a.id, a.name])), [allergens]);

  function newDish() {
    setEditing({
      id: "", user_id: "", name: "", category: "", description: "",
      allergen_ids: [], price: null, is_active: true, sort_order: rows.length,
      created_at: "", updated_at: "",
    } as any);
    setOpen(true);
  }

  function edit(d: MenuDish) { setEditing({ ...d }); setOpen(true); }

  async function save() {
    if (!editing) return;
    if (!editing.name) return toast.error("Nome obbligatorio");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessione scaduta");
    const payload = {
      user_id: user.id,
      name: editing.name,
      category: editing.category || null,
      description: editing.description || null,
      allergen_ids: editing.allergen_ids,
      price: editing.price,
      is_active: editing.is_active,
      sort_order: editing.sort_order,
    };
    const q = editing.id
      ? supabase.from("menu_dishes" as any).update(payload).eq("id", editing.id)
      : supabase.from("menu_dishes" as any).insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Salvato");
    setOpen(false); setEditing(null); reload();
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questo piatto?")) return;
    const { error } = await supabase.from("menu_dishes" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  function printMenu() {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const grouped = rows.reduce<Record<string, MenuDish[]>>((acc, d) => {
      if (!d.is_active) return acc;
      const k = d.category || "Menu";
      (acc[k] = acc[k] || []).push(d);
      return acc;
    }, {});
    const html = `<!doctype html><html><head><title>Menu allergeni</title>
      <style>
        body { font-family: Georgia, serif; padding: 20mm; color: #111; }
        h1 { text-align: center; margin: 0 0 4mm 0; }
        .legend { font-size: 9pt; color: #555; text-align: center; margin-bottom: 8mm; }
        h2 { border-bottom: 1px solid #000; padding-bottom: 2mm; margin-top: 8mm; font-size: 14pt; }
        .dish { margin: 4mm 0; }
        .dish .n { font-weight: 700; font-size: 11pt; }
        .dish .d { font-size: 9pt; color: #444; margin: 1mm 0; }
        .all { font-size: 8pt; color: #b00; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
        .price { float: right; font-weight: 700; }
      </style></head><body>
      <h1>Menu</h1>
      <div class="legend">Allergeni evidenziati secondo Reg. UE 1169/2011</div>
      ${Object.entries(grouped).map(([cat, items]) => `
        <h2>${cat}</h2>
        ${items.map((d) => `
          <div class="dish">
            ${d.price != null ? `<span class="price">€ ${Number(d.price).toFixed(2)}</span>` : ""}
            <div class="n">${escape(d.name)}</div>
            ${d.description ? `<div class="d">${escape(d.description)}</div>` : ""}
            ${d.allergen_ids.length ? `<div class="all">Allergeni: ${d.allergen_ids.map((id) => escape(allergenMap.get(id) || "")).filter(Boolean).join(", ")}</div>` : `<div class="all" style="color:#888">Nessun allergene dichiarato</div>`}
          </div>
        `).join("")}
      `).join("")}
      </body></html>`;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { w.print(); }, 250);
  }

  return (
    <>
      <PageHeader
        title="Menu allergeni"
        subtitle="Dichiarazione allergeni per piatto (Reg. UE 1169/2011)"
        action={
          <div className="flex gap-2">
            <Button onClick={printMenu} variant="outline" className="gap-2"><Printer size={16} /> Stampa menu</Button>
            <Button onClick={newDish} className="bg-gradient-primary gap-2"><Plus size={16} /> Nuovo piatto</Button>
          </div>
        }
      />

      <div className="space-y-2">
        {rows.map((d) => {
          const names = d.allergen_ids.map((id) => allergenMap.get(id)).filter(Boolean) as string[];
          return (
            <Card key={d.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold truncate">{d.name}</div>
                  {d.price != null && <span className="text-sm text-muted-foreground">€ {Number(d.price).toFixed(2)}</span>}
                  {!d.is_active && <Badge variant="outline">Nascosto</Badge>}
                </div>
                {d.category && <div className="text-xs text-muted-foreground mt-0.5">{d.category}</div>}
                {d.description && <p className="text-sm mt-1.5 text-muted-foreground">{d.description}</p>}
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {names.length > 0
                    ? names.map((n) => <Badge key={n} variant="secondary">{n}</Badge>)
                    : <Badge variant="outline" className="text-muted-foreground">Nessun allergene</Badge>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => edit(d)}><Pencil size={14} /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(d.id)}><Trash2 size={14} /></Button>
              </div>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <UtensilsCrossed className="mx-auto mb-2 opacity-50" size={28} />
            Nessun piatto. Aggiungi il primo per generare il menu allergeni.
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Modifica piatto" : "Nuovo piatto"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Input value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Antipasti, Primi…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Prezzo €</Label>
                  <Input type="number" step="0.01" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrizione</Label>
                <Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Allergeni</Label>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30 max-h-48 overflow-y-auto">
                  {allergens.map((a) => {
                    const checked = editing.allergen_ids.includes(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-1.5 text-sm cursor-pointer px-2 py-1 rounded hover:bg-background">
                        <Checkbox checked={checked} onCheckedChange={() => {
                          setEditing({
                            ...editing,
                            allergen_ids: checked ? editing.allergen_ids.filter((x) => x !== a.id) : [...editing.allergen_ids, a.id],
                          });
                        }} />
                        <span>{a.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: !!v })} />
                Visibile nel menu stampato
              </label>
              <Button onClick={save} className="w-full bg-gradient-primary">Salva</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function escape(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}