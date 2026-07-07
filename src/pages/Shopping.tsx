import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Printer, PackageCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export default function Shopping() {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    const { data } = await supabase
      .from("raw_materials")
      .select("*")
      .eq("is_out_of_stock", true)
      .order("category")
      .order("product_name");
    const list = data ?? [];
    setRows(list);
    setSelected(new Set());
  }
  useEffect(() => { load(); }, []);

  async function done(id: string) {
    const { error } = await supabase.from("raw_materials").update({ is_out_of_stock: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Segnato come riordinato");
    load();
  }

  function toggleOne(id: string, v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
      return next;
    });
  }
  function toggleAll(v: boolean) {
    setSelected(v ? new Set(rows.map((r) => r.id)) : new Set());
  }

  async function bulkDone() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { error } = await supabase.from("raw_materials").update({ is_out_of_stock: false }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} articoli segnati come riordinati`);
    load();
  }

  function printList() {
    if (rows.length === 0) {
      toast.info("Nessun articolo da stampare");
      return;
    }
    const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
    const grouped = rows.reduce<Record<string, any[]>>((acc, r) => {
      const key = r.category === "aroma" ? "Aromi"
        : r.category === "additivo_allergene" ? "Additivi / Allergeni"
        : "Materie prime";
      (acc[key] ||= []).push(r);
      return acc;
    }, {});
    const sections = Object.entries(grouped).map(([cat, items]) => `
      <h2>${cat}</h2>
      <table>
        <thead><tr><th style="width:24px"></th><th>Prodotto</th><th>Fornitore</th><th>Quantità</th></tr></thead>
        <tbody>
          ${items.map((r) => `
            <tr>
              <td><span class="chk"></span></td>
              <td>${escapeHtml(r.product_name || "")}</td>
              <td>${escapeHtml(r.supplier_name || "—")}</td>
              <td>${escapeHtml(r.quantity || "")}</td>
            </tr>`).join("")}
        </tbody>
      </table>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lista Acquisti — ${today}</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;color:#111}
        h1{margin:0 0 4px;font-size:22px}
        .sub{color:#666;font-size:12px;margin-bottom:20px}
        h2{font-size:14px;margin:20px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#444;border-bottom:1px solid #ddd;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #eee;vertical-align:middle}
        th{font-weight:600;color:#555;font-size:11px;text-transform:uppercase}
        .chk{border:1px solid #333;width:14px;height:14px;display:inline-block;border-radius:2px}
        @media print{ body{padding:12px} }
      </style></head><body>
      <h1>Lista Acquisti</h1>
      <div class="sub">${today} — ${rows.length} articoli da riordinare</div>
      ${sections}
      <script>window.onload=()=>{window.print();};</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return toast.error("Impossibile aprire la finestra di stampa");
    w.document.open(); w.document.write(html); w.document.close();
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <>
      <PageHeader title="Lista Acquisti" subtitle="Materie prime, aromi e additivi esauriti da riordinare" />
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} />
            Seleziona tutti ({rows.length})
          </label>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button size="sm" onClick={bulkDone} className="gap-1.5 bg-gradient-primary">
                <PackageCheck size={14} /> Riordina selezionati ({selected.size})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={printList} className="gap-1.5">
              <Printer size={14} /> Stampa lista
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {rows.map((r) => {
          const catLabel = r.category === "aroma" ? "Aroma"
            : r.category === "additivo_allergene" ? "Additivo/Allergene"
            : "Materia prima";
          const catClass = r.category === "aroma"
            ? "bg-purple-100 text-purple-800"
            : r.category === "additivo_allergene"
            ? "bg-blue-100 text-blue-800"
            : "bg-emerald-100 text-emerald-800";
          return (
          <Card key={r.id} className="p-4 flex items-center gap-3">
            <Checkbox
              checked={selected.has(r.id)}
              onCheckedChange={(v) => toggleOne(r.id, Boolean(v))}
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate flex items-center gap-2">
                {r.product_name}
                <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded ${catClass}`}>
                  {catLabel}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {r.supplier_name || "—"}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => done(r.id)} className="gap-1 shrink-0">
              <Check size={14} /> Riordinato
            </Button>
          </Card>
        );})}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-12">🎉 Magazzino in ordine, nessun articolo esaurito.</p>}
      </div>
    </>
  );
}