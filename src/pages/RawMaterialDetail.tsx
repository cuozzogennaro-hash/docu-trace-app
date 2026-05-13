import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileDown, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function RawMaterialDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const { session } = useAuth();
  const { operator } = useOperatorSession();
  const [material, setMaterial] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [departmentName, setDepartmentName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingRecurring, setSavingRecurring] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      if (!session && operator?.is_admin && operator?.pin) {
        const { data: res } = await supabase.rpc("operator_admin_get_raw_material" as any, {
          p_operator_id: operator.id,
          p_pin: operator.pin,
          p_id: id,
        });
        const payload = res as { ok: boolean; material?: any; department_name?: string; products?: any[] } | null;
        if (payload?.ok) {
          setMaterial(payload.material);
          setDepartmentName(payload.department_name ?? "");
          setProducts(payload.products ?? []);
        }
        setLoading(false);
        return;
      }
      const { data: mat } = await supabase
        .from("raw_materials")
        .select("*")
        .eq("id", id)
        .single();
      setMaterial(mat);

      if (mat?.department_id) {
        const { data: dep } = await supabase
          .from("departments")
          .select("name")
          .eq("id", mat.department_id)
          .single();
        setDepartmentName(dep?.name ?? "");
      }

      // Find products made with this raw material
      const { data: links } = await supabase
        .from("product_ingredients")
        .select("product_id")
        .eq("raw_material_id", id);

      if (links && links.length > 0) {
        const productIds = links.map((l: any) => l.product_id);
        const { data: prods } = await supabase
          .from("products")
          .select("*")
          .in("id", productIds)
          .order("production_date", { ascending: false });
        setProducts(prods ?? []);
      }
      setLoading(false);
    })();
  }, [id, session?.user?.id, operator?.id]);

  function downloadPdf() {
    if (!material) return;
    const isMacelleria = departmentName.toLowerCase().trim() === "macelleria";
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFontSize(16);
    doc.text("Scheda Materia Prima", 14, 20);
    doc.setFontSize(10);
    if (company?.business_name) doc.text(company.business_name, 14, 28);
    if (company?.address) doc.text(company.address, 14, 33);

    let y = company?.address ? 42 : company?.business_name ? 37 : 30;

    const info = [
      ["Prodotto", material.product_name],
      ["Reparto", departmentName || "—"],
      ["Fornitore", material.supplier_name || "—"],
      ["Lotto interno", material.internal_lot],
      ["Lotto fornitore", material.supplier_lot || "—"],
      ["Quantità", material.quantity || "—"],
      ["Data documento", material.document_date || "—"],
      ["Scadenza", material.expiry_date || "—"],
      ["Provenienza", material.origin || "—"],
    ];

    if (isMacelleria) {
      info.push(
        ["Nato in", material.born_in || "—"],
        ["Allevato in", material.raised_in || "—"],
        ["Macellato in", material.slaughtered_in || "—"],
        ["Bollo CE", material.slaughter_mark || "—"],
      );
    }

    autoTable(doc, {
      startY: y,
      head: [["Campo", "Valore"]],
      body: info,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    if (products.length > 0) {
      doc.setFontSize(13);
      doc.text("Prodotti realizzati con questa materia prima", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Nome", "Lotto", "Data produzione", "Note"]],
        body: products.map((p) => [
          p.name,
          p.internal_lot,
          p.production_date || "—",
          p.notes || "",
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

    doc.save(`materia_prima_${material.internal_lot}.pdf`);
  }

  async function saveAsRecurring() {
    if (!material) return;
    setSavingRecurring(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingRecurring(false); return; }
    const payload: any = {
      user_id: user.id,
      product_name: material.product_name,
      supplier_name: material.supplier_name || null,
      category: material.category || "materia_prima",
      department_id: material.department_id || null,
      quantity: material.quantity || null,
      origin: material.origin || null,
      ingredients: material.ingredients || null,
      born_in: material.born_in || null,
      raised_in: material.raised_in || null,
      slaughtered_in: material.slaughtered_in || null,
      slaughter_mark: material.slaughter_mark || null,
    };
    const { error } = await (supabase as any).from("recurring_raw_materials").insert(payload);
    setSavingRecurring(false);
    if (error) return toast.error(error.message);
    toast.success("Salvato come prodotto ricorrente");
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!material) return <div className="py-12 text-center text-muted-foreground">Materia prima non trovata.</div>;

  const isMacelleria = departmentName.toLowerCase().trim() === "macelleria";

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/archivio")}>
          <ArrowLeft size={18} />
        </Button>
        <PageHeader title={material.product_name} subtitle={`Lotto ${material.internal_lot}`} />
      </div>

      <Card className="p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {departmentName && <Info label="Reparto" value={departmentName} />}
          <Info label="Fornitore" value={material.supplier_name} />
          <Info label="Lotto fornitore" value={material.supplier_lot} />
          <Info label="Quantità" value={material.quantity} />
          <Info label="Data documento" value={material.document_date} />
          <Info label="Scadenza" value={material.expiry_date} />
          <Info label="Provenienza / Origine" value={material.origin} />
        </div>
        {isMacelleria && (
          <div className="mt-4 p-3 rounded-md bg-orange-50 border border-orange-200">
            <div className="text-xs font-semibold text-orange-900 mb-2">Tracciabilità carne</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Info label="Nato in" value={material.born_in} />
              <Info label="Allevato in" value={material.raised_in} />
              <Info label="Macellato in" value={material.slaughtered_in} />
              <Info label="Bollo CE" value={material.slaughter_mark} />
            </div>
          </div>
        )}
        <Button onClick={downloadPdf} className="mt-5 gap-2 bg-gradient-primary">
          <FileDown size={16} /> Scarica PDF
        </Button>
        {session && (
          <Button onClick={saveAsRecurring} variant="outline" disabled={savingRecurring} className="mt-5 ml-2 gap-2">
            <Star size={16} className="text-amber-500" /> {savingRecurring ? "Salvataggio…" : "Salva come ricorrente"}
          </Button>
        )}
      </Card>

      <h2 className="font-display font-bold text-lg mb-3">
        Prodotti realizzati ({products.length})
      </h2>
      {products.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nessun prodotto collegato a questa materia prima.</Card>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <Card
              key={p.id}
              className="p-4 cursor-pointer hover:bg-muted/40 transition"
              onClick={() => navigate(`/archivio/prodotto/${p.id}`)}
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                {p.production_date} • <span className="font-mono">{p.internal_lot}</span>
              </div>
              {p.notes && <div className="text-xs mt-1 text-muted-foreground">{p.notes}</div>}
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