import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileDown, Loader2, Printer } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  const [labelQty, setLabelQty] = useState(1);

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
        .select("raw_materials(id, product_name, internal_lot, supplier_name, supplier_lot, origin, quantity, expiry_date, category)")
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

  const PX_PER_MM = 3.78;

  function getValueMap() {
    const allergenSet = new Set(
      ingredients.filter((m: any) => (m.category || "materia_prima") === "additivo_allergene").map((m: any) => m.id)
    );
    // Build combined list: all ingredient names, allergens will be handled separately for bold
    const allNames = ingredients.map((m: any) => m.product_name);
    const ingredientsList = allNames.join(", ");
    const allergenNames = ingredients.filter((m: any) => allergenSet.has(m.id)).map((m: any) => m.product_name);
    return {
      valueMap: {
        company_name: company?.business_name ?? "",
        product_name: product?.name ?? "",
        internal_lot: `Lotto: ${product?.internal_lot ?? ""}`,
        production_date: `Data prod.: ${product?.production_date ?? "—"}`,
        expiry_date: `Scadenza: ${ingredients[0]?.expiry_date ?? "—"}`,
        ingredients: `Ingr.: ${ingredientsList || "—"}`,
        company_address: company?.address ?? "",
      } as Record<string, string>,
      allergenNames,
    };
  }

  async function printLabel() {
    if (!product) return;
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
    if (!tpl) { toast.error("Seleziona un template"); return; }

    const config = typeof tpl.layout_config === "string" ? JSON.parse(tpl.layout_config) : tpl.layout_config;
    const fields: any[] = config.fields ?? [];
    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);

    const { valueMap, allergenNames } = getValueMap();

    // Pre-load logo as base64 if available
    let logoDataUrl: string | null = null;
    const logoField = fields.find((f: any) => f.key === "logo" && f.visible);
    if (logoField && company?.logo_url) {
      try {
        const resp = await fetch(company.logo_url);
        const blob = await resp.blob();
        logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { /* skip logo on error */ }
    }

    const pageW = wMm;
    const pageH = hMm;
    const orient = pageW > pageH ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation: orient as any, unit: "mm", format: [pageW, pageH] });

    for (let copy = 0; copy < labelQty; copy++) {
      if (copy > 0) doc.addPage([pageW, pageH], orient as any);

      for (const f of fields) {
        if (!f.visible) continue;
        if (f.key === "logo") {
          if (logoDataUrl) {
            try {
              doc.addImage(logoDataUrl, "PNG", f.x, f.y, f.width ?? 25, f.height ?? 15);
            } catch { /* skip */ }
          }
          continue;
        }

        const text = valueMap[f.key] ?? "";
        if (!text) continue;

        doc.setFontSize(f.fontSize ?? 10);
        doc.setFont("helvetica", f.bold ? "bold" : "normal");

        const maxWidth = pageW - f.x - 2;

        if (f.key === "ingredients" && allergenNames.length > 0) {
          // Print ingredients with allergens inline in bold
          const prefix = "Ingr.: ";
          let curX = f.x;
          let curY = f.y + (f.fontSize ?? 10) * 0.35;
          const fontSize = f.fontSize ?? 10;
          const lineH = fontSize * 0.4;

          // Print prefix
          doc.setFont("helvetica", f.bold ? "bold" : "normal");
          doc.text(prefix, curX, curY);
          curX += doc.getTextWidth(prefix);

          ingredients.forEach((m: any, idx: number) => {
            const isAllergen = allergenNames.includes(m.product_name);
            const separator = idx < ingredients.length - 1 ? ", " : "";
            const chunk = m.product_name + separator;

            doc.setFont("helvetica", isAllergen ? "bold" : "normal");
            const chunkW = doc.getTextWidth(chunk);

            if (curX + chunkW > f.x + maxWidth && curX > f.x) {
              curX = f.x;
              curY += lineH;
            }

            doc.text(chunk, curX, curY);
            curX += chunkW;
          });
        } else {
          const lines = doc.splitTextToSize(text, maxWidth);
          doc.text(lines, f.x, f.y + (f.fontSize ?? 10) * 0.35);
        }
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stampa Etichetta</DialogTitle>
            <DialogDescription>Seleziona template e quantità, verifica l'anteprima e stampa.</DialogDescription>
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
            <div>
              <Label className="text-sm font-medium">Quantità etichette</Label>
              <Input type="number" min={1} max={100} value={labelQty} onChange={(e) => setLabelQty(Math.max(1, +e.target.value))} />
            </div>

            {/* Live preview */}
            {selectedTemplate && (() => {
              const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
              if (!tpl) return null;
              const config = typeof tpl.layout_config === "string" ? JSON.parse(tpl.layout_config) : tpl.layout_config;
              const fields: any[] = config.fields ?? [];
              const wMm = Number(tpl.width_mm);
              const hMm = Number(tpl.height_mm);
              const { valueMap, allergenNames } = getValueMap();
              const logoUrl = company?.logo_url;
              return (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Anteprima</Label>
                  <div className="border rounded-lg p-3 bg-muted/30 overflow-auto">
                    <div
                      className="relative bg-white border border-dashed border-border mx-auto"
                      style={{ width: wMm * PX_PER_MM, height: hMm * PX_PER_MM }}
                    >
                      {fields.filter((f: any) => f.visible).map((f: any) => {
                        if (f.key === "logo") {
                          return logoUrl ? (
                            <img
                              key={f.key}
                              src={logoUrl}
                              alt="Logo"
                              className="absolute object-contain"
                              style={{
                                left: f.x * PX_PER_MM,
                                top: f.y * PX_PER_MM,
                                width: (f.width ?? 25) * PX_PER_MM,
                                height: (f.height ?? 15) * PX_PER_MM,
                              }}
                            />
                          ) : (
                            <div
                              key={f.key}
                              className="absolute bg-muted/50 border border-dashed border-muted-foreground/30 flex items-center justify-center text-[8px] text-muted-foreground"
                              style={{
                                left: f.x * PX_PER_MM,
                                top: f.y * PX_PER_MM,
                                width: (f.width ?? 25) * PX_PER_MM,
                                height: (f.height ?? 15) * PX_PER_MM,
                              }}
                            >
                              LOGO
                            </div>
                          );
                        }
                        const text = valueMap[f.key] ?? "";
                        const isIngredients = f.key === "ingredients";
                        return (
                          <div key={f.key} className="absolute" style={{ left: f.x * PX_PER_MM, top: f.y * PX_PER_MM, maxWidth: (wMm - f.x - 2) * PX_PER_MM }}>
                            {isIngredients && allergenNames.length > 0 ? (
                              <span
                                className="text-black block"
                                style={{
                                  fontSize: f.fontSize * (PX_PER_MM / 2.835),
                                  lineHeight: 1.3,
                                  wordBreak: "break-word",
                                }}
                              >
                                Ingr.:{" "}
                                {ingredients.map((m: any, idx: number) => (
                                  <span key={m.id} style={{ fontWeight: allergenNames.includes(m.product_name) ? 700 : 400 }}>
                                    {m.product_name}{idx < ingredients.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span
                                className="text-black block"
                                style={{
                                  fontSize: f.fontSize * (PX_PER_MM / 2.835),
                                  fontWeight: f.bold ? 700 : 400,
                                  lineHeight: 1.3,
                                  wordBreak: "break-word",
                                }}
                              >
                                {text}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {wMm} × {hMm} mm
                  </p>
                </div>
              );
            })()}

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