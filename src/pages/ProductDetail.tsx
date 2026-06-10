import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileDown, Loader2, Printer, Trash2, FileText } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";
import { useLabelRules } from "@/hooks/useLabelRules";
import TemplatedLabelDialog from "@/components/labels/TemplatedLabelDialog";
import { computeLabelLayout, formatDateDDMMYY, type LabelData } from "@/lib/labelLayout";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const { departments } = useDepartments();
  const { param: ruleParam } = useLabelRules();
  const { session } = useAuth();
  const { operator } = useOperatorSession();
  const [product, setProduct] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [blastChillings, setBlastChillings] = useState<any[]>([]);
  const [holdingRecords, setHoldingRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelTemplates, setLabelTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [btPrinting, setBtPrinting] = useState(false);
  const [adminDeptName, setAdminDeptName] = useState<string>("");
  const [preservationOverride, setPreservationOverride] = useState<"fresh" | "vacuum" | "">("");
  const [allergenKeywordsDb, setAllergenKeywordsDb] = useState<string[] | null>(null);
  const [allergenNamesDb, setAllergenNamesDb] = useState<string[]>([]);
  // Mappa keyword(lowercase) -> nome canonico dell'allergene (es. "grano" -> "Glutine").
  const [allergenKeyToName, setAllergenKeyToName] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      if (!session && operator?.is_admin && operator?.pin) {
        const { data: res } = await supabase.rpc("operator_admin_get_product" as any, {
          p_operator_id: operator.id,
          p_pin: operator.pin,
          p_id: id,
        });
        const payload = res as { ok: boolean; product?: any; ingredients?: any[]; label_templates?: any[]; department_name?: string } | null;
        if (payload?.ok) {
          setProduct(payload.product);
          setIngredients(payload.ingredients ?? []);
          setAdminDeptName(payload.department_name ?? "");
          const tpls = payload.label_templates ?? [];
          setLabelTemplates(tpls);
          const def = tpls.find((t: any) => t.is_default);
          if (def) setSelectedTemplate(def.id);
          else if (tpls.length > 0) setSelectedTemplate(tpls[0].id);
        }
        setLoading(false);
        return;
      }
      const { data: prod } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      setProduct(prod);

      const { data: links } = await supabase
        .from("product_ingredients")
        .select("raw_materials(id, product_name, internal_lot, supplier_name, supplier_lot, origin, quantity, expiry_date, category, born_in, raised_in, slaughtered_in, meat_type, slaughter_mark, ingredients)")
        .eq("product_id", id);

      setIngredients((links ?? []).map((l: any) => l.raw_materials).filter(Boolean));

      // Load related blast chillings (per product_id o per lotto nel nome)
      const lot = prod?.internal_lot;
      const { data: bcById } = await (supabase as any)
        .from("blast_chillings")
        .select("*")
        .eq("product_id", id)
        .order("started_at", { ascending: false });
      let bcRows = bcById ?? [];
      if (lot) {
        const { data: bcByLot } = await (supabase as any)
          .from("blast_chillings")
          .select("*")
          .ilike("product_name", `%${lot}%`)
          .order("started_at", { ascending: false });
        const seen = new Set(bcRows.map((r: any) => r.id));
        for (const r of (bcByLot ?? [])) if (!seen.has(r.id)) bcRows.push(r);
      }
      setBlastChillings(bcRows);

      // Load related holding records (per lotto nel nome o note)
      let hRows: any[] = [];
      if (lot) {
        const { data: hByName } = await (supabase as any)
          .from("holding_records")
          .select("*")
          .ilike("product_name", `%${lot}%`)
          .order("recorded_at", { ascending: false });
        const { data: hByNotes } = await (supabase as any)
          .from("holding_records")
          .select("*")
          .ilike("notes", `%${lot}%`)
          .order("recorded_at", { ascending: false });
        const seen = new Set<string>();
        for (const r of [...(hByName ?? []), ...(hByNotes ?? [])]) {
          if (!seen.has(r.id)) { seen.add(r.id); hRows.push(r); }
        }
      }
      setHoldingRecords(hRows);

      // Load label templates
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tpls } = await supabase.from("label_templates").select("*").eq("user_id", user.id).order("created_at");
        setLabelTemplates(tpls ?? []);
        const def = (tpls ?? []).find((t: any) => t.is_default);
        if (def) setSelectedTemplate(def.id);
        else if (tpls && tpls.length > 0) setSelectedTemplate(tpls[0].id);
      }

      setLoading(false);
    })();
  }, [id, session?.user?.id, operator?.id]);

  // Carica le keyword degli allergeni dalla scheda dedicata (solo se autenticati).
  // Quando il flusso è admin-operator senza sessione, ricadiamo sull'elenco di legge.
  useEffect(() => {
    if (!session?.user) { setAllergenKeywordsDb(null); return; }
    (async () => {
      const { data } = await supabase
        .from("allergens" as any)
        .select("name, keywords")
        .eq("user_id", session.user.id);
      const all = (((data as any[]) ?? [])
        .flatMap((r) => (r.keywords as string[]) || []))
        .map((k) => (k || "").toLowerCase().trim())
        .filter(Boolean);
      setAllergenKeywordsDb(Array.from(new Set(all)));
      const names = (((data as any[]) ?? [])
        .map((r) => (r.name || "").toLowerCase().trim())
        .filter(Boolean));
      setAllergenNamesDb(Array.from(new Set(names)));
      const map: Record<string, string> = {};
      for (const r of (data as any[]) ?? []) {
        const canonical = (r.name || "").toString().trim();
        if (!canonical) continue;
        for (const kw of (r.keywords as string[]) || []) {
          const k = (kw || "").toLowerCase().trim();
          if (k && !map[k]) map[k] = canonical;
        }
        const nk = canonical.toLowerCase();
        if (!map[nk]) map[nk] = canonical;
      }
      setAllergenKeyToName(map);
    })();
  }, [session?.user?.id]);


  async function removeIngredient(rawId: string) {
    if (!session?.user) {
      toast.error("Operazione disponibile solo per il titolare loggato.");
      return;
    }
    if (!confirm("Rimuovere questo ingrediente dal prodotto?")) return;
    const { error } = await supabase
      .from("product_ingredients")
      .delete()
      .eq("product_id", id!)
      .eq("raw_material_id", rawId);
    if (error) return toast.error(error.message);
    setIngredients((prev) => prev.filter((m: any) => m.id !== rawId));
    toast.success("Ingrediente rimosso");
  }

  function downloadPdf() {
    if (!product) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFontSize(16);
    doc.text("Scheda Prodotto", 14, 20);
    doc.setFontSize(10);
    if (company?.business_name) doc.text(company.business_name, 14, 28);
    if (company?.address) doc.text(company.address, 14, 33);

    let y = company?.address ? 42 : company?.business_name ? 37 : 30;

    const info = [
      ["Nome", product.name],
      ["Lotto interno", product.internal_lot],
      ["Data produzione", product.production_date || "—"],
      ["Note", product.notes || "—"],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Campo", "Valore"]],
      body: info,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    if (blastChillings.length > 0) {
      doc.setFontSize(13);
      doc.text("Abbattimenti", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Ciclo", "T inizio", "T fine", "Inizio", "Fine", "Durata", "Esito"]],
        body: blastChillings.map((b) => {
          const dur = b.ended_at ? Math.round((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 60000) + " min" : "—";
          return [
            b.cycle_type === "negative" ? "Negativo (-18°C)" : "Positivo (+3°C)",
            b.temp_start != null ? `${b.temp_start}°C` : "—",
            b.temp_end != null ? `${b.temp_end}°C` : "—",
            b.started_at ? new Date(b.started_at).toLocaleString("it-IT") : "—",
            b.ended_at ? new Date(b.ended_at).toLocaleString("it-IT") : "In corso",
            dur,
            b.outcome === "ok" ? "Conforme" : "Anomalia",
          ];
        }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (holdingRecords.length > 0) {
      doc.setFontSize(13);
      doc.text("Mantenimento & Rigenerazione", 14, y);
      y += 6;
      const MODE_LBL: Record<string, string> = {
        hot: "Caldo ≥60°C",
        cold: "Freddo ≤4°C",
        regeneration: "Rigenerazione ≥70°C",
      };
      autoTable(doc, {
        startY: y,
        head: [["Modalità", "°C", "Rilevato", "Esito", "Note"]],
        body: holdingRecords.map((h) => [
          MODE_LBL[h.mode] ?? h.mode,
          h.temperature != null ? `${h.temperature}°C` : "—",
          h.recorded_at ? new Date(h.recorded_at).toLocaleString("it-IT") : "—",
          h.outcome === "ok" ? "Conforme" : h.outcome === "anomaly" ? "Anomalia" : "Da completare",
          h.notes ?? "—",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (ingredients.length > 0) {
      doc.setFontSize(13);
      doc.text("Materie prime utilizzate", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Prodotto", "Fornitore", "Lotto int.", "Lotto forn.", "Provenienza", "Scadenza"]],
        body: ingredients.map((m) => [
          m.product_name,
          m.supplier_name || "—",
          m.internal_lot,
          m.supplier_lot || "—",
          m.origin || "—",
          m.expiry_date || "—",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Generato il ${new Date().toLocaleDateString("it-IT")} — Pagina ${i}/${pageCount}`, 14, 290);
    }

    doc.save(`prodotto_${product.internal_lot}.pdf`);
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!product) return <div className="py-12 text-center text-muted-foreground">Prodotto non trovato.</div>;

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/archivio")}>
          <ArrowLeft size={18} />
        </Button>
        <PageHeader title={product.name} subtitle={`Lotto ${product.internal_lot}`} />
      </div>

      <Card className="p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Info label="Data produzione" value={product.production_date} />
          <Info label="Lotto interno" value={product.internal_lot} />
          <Info label="Note" value={product.notes} />
        </div>
        <Button onClick={downloadPdf} className="mt-5 gap-2 bg-gradient-primary">
          <FileDown size={16} /> Scarica PDF
        </Button>
        {labelTemplates.length > 0 && (
          <Button onClick={() => setShowLabelDialog(true)} variant="outline" className="mt-5 ml-2 gap-2">
            <Printer size={16} /> Stampa Etichetta
          </Button>
        )}
      </Card>

      {blastChillings.length > 0 && (
        <Card className="p-5 mb-6">
          <h3 className="font-display font-bold mb-3">Abbattimenti</h3>
          <div className="space-y-2">
            {blastChillings.map((b) => {
              const dur = b.ended_at ? Math.round((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 60000) : null;
              return (
                <div key={b.id} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold">
                      {b.cycle_type === "negative" ? "Surgelazione (-18°C)" : "Abbattimento (+3°C)"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${b.outcome === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-destructive/15 text-destructive"}`}>
                      {b.ended_at ? (b.outcome === "ok" ? "Conforme" : "Anomalia") : "Da completare"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {new Date(b.started_at).toLocaleString("it-IT")}
                    {b.ended_at && ` → ${new Date(b.ended_at).toLocaleString("it-IT")}`}
                    {dur != null && ` • ${dur} min`}
                    {b.temp_start != null && ` • ${b.temp_start}°C → ${b.temp_end ?? "—"}°C`}
                  </div>
                  {b.notes && <div className="text-xs text-muted-foreground mt-1">{b.notes}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      __TEMPLATED_LABEL_DIALOG_PLACEHOLDER__

      <h2 className="font-display font-bold text-lg mb-3">
        Materie prime utilizzate ({ingredients.length})
      </h2>
      {ingredients.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nessuna materia prima collegata.</Card>
      ) : (
        <div className="space-y-2">
          {ingredients.map((m) => (
            <Card
              key={m.id}
              className="p-4 hover:bg-muted/40 transition flex items-center justify-between gap-3"
            >
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => navigate(`/archivio/materia-prima/${m.id}`)}
              >
                <div className="font-semibold truncate">{m.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  {m.supplier_name || "—"} • <span className="font-mono">{m.internal_lot}</span>
                  {m.origin && <> • Origine: {m.origin}</>}
                </div>
              </div>
              {session?.user && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); removeIngredient(m.id); }}
                  title="Rimuovi dal prodotto"
                >
                  <Trash2 size={16} className="text-destructive" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}