import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { toast } from "sonner";

export default function Shopping() {
  const [rows, setRows] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase.from("raw_materials").select("*").eq("is_out_of_stock", true).order("category").order("product_name");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function done(id: string) {
    await supabase.from("raw_materials").update({ is_out_of_stock: false }).eq("id", id);
    toast.success("Segnato come riordinato");
    load();
  }

  return (
    <>
      <PageHeader title="Lista Acquisti" subtitle="Materie prime, aromi e additivi esauriti da riordinare" />
      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">{r.product_name}</div>
              <div className="text-xs text-muted-foreground">
                {r.supplier_name || "—"}
                {r.category && r.category !== "materia_prima" && (
                  <> • {r.category === "aroma" ? "Aroma" : "Additivo/Allergene"}</>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => done(r.id)} className="gap-1">
              <Check size={14} /> Riordinato
            </Button>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-12">🎉 Magazzino in ordine, nessun articolo esaurito.</p>}
      </div>
    </>
  );
}