import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Printer, Lock, PackageCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export default function Shopping() {
  const [rows, setRows] = useState<any[]>([]);
  const [usedIn, setUsedIn] = useState<Record<string, number>>({});
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

    // Count how many products still reference each of these raw materials
    if (list.length > 0) {
      const ids = list.map((r: any) => r.id);
      const { data: pi } = await supabase
        .from("product_ingredients")
        .select("raw_material_id")
        .in("raw_material_id", ids);
      const counts: Record<string, number> = {};
      for (const row of (pi as any[]) ?? []) {
        counts[row.raw_material_id] = (counts[row.raw_material_id] ?? 0) + 1;
      }
      setUsedIn(counts);
    } else {
      setUsedIn({});
    }
  }
  useEffect(() => { load(); }, []);

  function isLocked(id: string) {
    return (usedIn[id] ?? 0) > 0;
  }

  async function done(id: string, name: string) {
    if (isLocked(id)) {
      if (!confirm(`"${name}" è usata come ingrediente in ${usedIn[id]} prodott${usedIn[id] === 1 ? "o" : "i"}: non può essere eliminata per non rompere la tracciabilità.\n\nVuoi solo segnarla come "di nuovo disponibile"?`)) return;
      const { error } = await supabase.from("raw_materials").update({ is_out_of_stock: false }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Segnata come disponibile (mantenuta in archivio)");
      load();
      return;
    }
    if (!confirm(`Confermi il riordino di "${name}"? L'articolo verrà eliminato definitivamente dall'archivio.`)) return;
    const { error } = await supabase.from("raw_materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Riordinato ed eliminato dall'archivio");
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
    const deletable = ids.filter((id) => !isLocked(id));
    const locked = ids.filter((id) => isLocked(id));
    if (!confirm(`Confermi il riordino di ${ids.length} articoli?\n• ${deletable.length} verranno eliminati dall'archivio\n• ${locked.length} sono usati in prodotti e verranno solo rimessi come disponibili.`)) return;

    let okDel = 0, okUpd = 0;
    if (deletable.length > 0) {
      const { error } = await supabase.from("raw_materials").delete().in("id", deletable);
      if (error) toast.error("Errore eliminazione: " + error.message);
      else okDel = deletable.length;
    }
    if (locked.length > 0) {
      const { error } = await supabase.from("raw_materials").update({ is_out_of_stock: false }).in("id", locked);
      if (error) toast.error("Errore aggiornamento: " + error.message);
      else okUpd = locked.length;
    }
    toast.success(`Completato: ${okDel} eliminati, ${okUpd} rimessi disponibili`);
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

  const lockedCount = rows.filter((r) => isLocked(r.id)).length;
  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <>
      <PageHeader title="Lista Acquisti" subtitle="Materie prime, aromi e additivi esauriti da riordinare" />
      {lockedCount > 0 && (
        <Card className="p-3 mb-3 bg-amber-50 border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <div>
            {lockedCount} articol{lockedCount === 1 ? "o è" : "i sono"} usati come ingredienti in prodotti registrati e non possono essere eliminati (tracciabilità). Verranno invece riportati come "disponibili" al riordino.
          </div>
        </Card>
      )}
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
        {rows.map((r) => (
          <Card
            key={r.id}
            className={`p-4 flex items-center gap-3 ${isLocked(r.id) ? "border-amber-300 bg-amber-50/40" : ""}`}
          >
            <Checkbox
              checked={selected.has(r.id)}
              onCheckedChange={(v) => toggleOne(r.id, Boolean(v))}
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate flex items-center gap-2">
                {r.product_name}
                {isLocked(r.id) && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900">
                    <Lock size={10} /> usato in {usedIn[r.id]} prodott{usedIn[r.id] === 1 ? "o" : "i"}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.supplier_name || "—"}
                {r.category && r.category !== "materia_prima" && (
                  <> • {r.category === "aroma" ? "Aroma" : "Additivo/Allergene"}</>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => done(r.id, r.product_name)} className="gap-1 shrink-0">
              <Check size={14} /> Riordinato
            </Button>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-12">🎉 Magazzino in ordine, nessun articolo esaurito.</p>}
      </div>
    </>
  );
}