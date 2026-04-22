import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Factory, Check } from "lucide-react";
import { generateInternalLot } from "@/lib/lot";

export default function Production() {
  const [name, setName] = useState("");
  const [prodDate, setProdDate] = useState(new Date().toISOString().slice(0, 10));
  const [lot, setLot] = useState(generateInternalLot("P"));
  const [notes, setNotes] = useState("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from("raw_materials").select("id, product_name, internal_lot").order("product_name"),
      supabase.from("products").select("*, product_ingredients(raw_materials(product_name, internal_lot))").order("production_date", { ascending: false }).limit(20),
    ]);
    setMaterials(m ?? []);
    setRows(p ?? []);
  }
  useEffect(() => { load(); }, []);

  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  async function save() {
    if (!name) return toast.error("Nome prodotto richiesto");
    if (selected.size === 0) return toast.error("Seleziona almeno un ingrediente");
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prod, error } = await supabase
      .from("products")
      .insert({ user_id: user!.id, name, production_date: prodDate, internal_lot: lot, notes })
      .select()
      .single();
    if (error) return toast.error(error.message);
    const ingredients = Array.from(selected).map((rm) => ({
      product_id: prod.id,
      raw_material_id: rm,
      user_id: user!.id,
    }));
    await supabase.from("product_ingredients").insert(ingredients);
    toast.success(`Prodotto creato • ${lot}`);
    setName("");
    setNotes("");
    setSelected(new Set());
    setLot(generateInternalLot("P"));
    load();
  }

  return (
    <>
      <PageHeader title="Produzione" subtitle="Crea semilavorati e prodotti finiti con tracciabilità ingredienti" />

      <Card className="p-5 mb-6 shadow-soft">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome prodotto</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ragù della casa" />
          </div>
          <div className="space-y-2">
            <Label>Data produzione</Label>
            <Input type="date" value={prodDate} onChange={(e) => setProdDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Lotto interno</Label>
            <Input value={lot} readOnly className="font-mono bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="mt-5">
          <Label className="mb-2 block">Ingredienti (dal registro materie prime)</Label>
          <div className="max-h-64 overflow-auto rounded-lg border border-border p-2 space-y-1 bg-muted/30">
            {materials.length === 0 && <p className="text-sm text-muted-foreground p-3">Nessuna materia prima. Aggiungi prima un ingresso merci.</p>}
            {materials.map((m) => {
              const on = selected.has(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition ${
                    on ? "bg-primary text-primary-foreground" : "hover:bg-card"
                  }`}
                >
                  <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary-foreground border-primary-foreground" : "border-border"}`}>
                    {on && <Check size={14} className="text-primary" />}
                  </div>
                  <span className="flex-1 text-sm">{m.product_name}</span>
                  <span className="font-mono text-xs opacity-70">{m.internal_lot}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Button onClick={save} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <Factory size={16} /> Crea prodotto
        </Button>
      </Card>

      <div className="space-y-2">
        {rows.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.production_date} • <span className="font-mono">{p.internal_lot}</span></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.product_ingredients?.map((pi: any, i: number) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {pi.raw_materials?.product_name} <span className="font-mono opacity-60">• {pi.raw_materials?.internal_lot}</span>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}