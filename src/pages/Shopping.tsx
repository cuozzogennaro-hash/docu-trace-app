import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Printer } from "lucide-react";
import { toast } from "sonner";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export default function Shopping() {
  const [rows, setRows] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase
      .from("raw_materials")
      .select("*")
      .eq("is_out_of_stock", true)
      .order("category")
      .order("product_name");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function done(id: string, name: string) {
    if (!confirm(`Confermi il riordino di "${name}"? L'articolo verrà eliminato definitivamente dall'archivio.`)) return;
    const { error } = await supabase.from("raw_materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Riordinato ed eliminato dall'archivio");
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

  return (
    <>
      <PageHeader title="Lista Acquisti" subtitle="Materie prime, aromi e additivi esauriti da riordinare" />
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={printList} disabled={rows.length === 0} className="gap-1.5">
          <Printer size={14} /> Stampa lista
        </Button>
      </div>
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
            <Button size="sm" variant="outline" onClick={() => done(r.id, r.product_name)} className="gap-1">
              <Check size={14} /> Riordinato
            </Button>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-12">🎉 Magazzino in ordine, nessun articolo esaurito.</p>}
      </div>
    </>
  );
}