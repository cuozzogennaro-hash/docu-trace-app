import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileDown, Loader2, Printer } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const [product, setProduct] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelTemplates, setLabelTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showLabelDialog, setShowLabelDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: prod } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      setProduct(prod);

      const { data: links } = await supabase
        .from("product_ingredients")
        .select("raw_materials(id, product_name, internal_lot, supplier_name, supplier_lot, origin, quantity, expiry_date)")
        .eq("product_id", id);

      setIngredients((links ?? []).map((l: any) => l.raw_materials).filter(Boolean));

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
  }, [id]);

  function printLabel() {
    if (!product) return;
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
    if (!tpl) { toast.error("Seleziona un template"); return; }

    const config = typeof tpl.layout_config === "string" ? JSON.parse(tpl.layout_config) : tpl.layout_config;
    const fields: any[] = config.fields ?? [];
    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);

    const ingredientsList = ingredients.map((m: any) => m.product_name).join(", ");

    const valueMap: Record<string, string> = {
      company_name: company?.business_name ?? "",
      product_name: product.name ?? "",
      internal_lot: `Lotto: ${product.internal_lot ?? ""}`,
      production_date: `Data prod.: ${product.production_date ?? "—"}`,
      expiry_date: `Scadenza: ${ingredients[0]?.expiry_date ?? "—"}`,
      ingredients: `Ingr.: ${ingredientsList || "—"}`,
      company_address: company?.address ?? "",
    };

    const doc = new jsPDF({ orientation: wMm > hMm ? "landscape" : "portrait", unit: "mm", format: [wMm, hMm] });

    for (const f of fields) {
      if (!f.visible) continue;
      if (f.key === "logo" && company?.logo_url) {
        // skip logo in PDF for simplicity — thermal printers often don't support images well
        continue;
      }
      if (f.key === "logo") continue;

      const text = valueMap[f.key] ?? "";
      if (!text) continue;

      doc.setFontSize(f.fontSize ?? 10);
      doc.setFont("helvetica", f.bold ? "bold" : "normal");

      // Wrap text for ingredients
      if (f.key === "ingredients") {
        const maxWidth = wMm - f.x - 3;
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, f.x, f.y + (f.fontSize ?? 10) * 0.35);
      } else {
        doc.text(text, f.x, f.y + (f.fontSize ?? 10) * 0.35);
      }
    }

    // Open print dialog
    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.addEventListener("load", () => {
        printWindow.print();
      });
    }
    setShowLabelDialog(false);
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

      <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stampa Etichetta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Template etichetta</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona template" />
                </SelectTrigger>
                <SelectContent>
                  {labelTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({Number(t.width_mm)}×{Number(t.height_mm)} mm)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={printLabel} className="w-full gap-2">
              <Printer size={16} /> Stampa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              className="p-4 cursor-pointer hover:bg-muted/40 transition"
              onClick={() => navigate(`/archivio/materia-prima/${m.id}`)}
            >
              <div className="font-semibold">{m.product_name}</div>
              <div className="text-xs text-muted-foreground">
                {m.supplier_name || "—"} • <span className="font-mono">{m.internal_lot}</span>
                {m.origin && <> • Origine: {m.origin}</>}
              </div>
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