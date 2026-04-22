import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Camera, Loader2, Package, Sparkles } from "lucide-react";
import { generateInternalLot } from "@/lib/lot";

export default function Incoming() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [supplierName, setSupplierName] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [productName, setProductName] = useState("");
  const [supplierLot, setSupplierLot] = useState("");
  const [internalLot, setInternalLot] = useState(generateInternalLot("L"));
  const [quantity, setQuantity] = useState("");
  const [expiry, setExpiry] = useState("");
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("raw_materials")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    setOcrLoading(true);
    try {
      const base64 = await toBase64(file);
      const { data, error } = await supabase.functions.invoke("ocr-document", {
        body: { imageBase64: base64, mimeType: file.type },
      });
      if (error) throw error;
      const d = data?.data ?? {};
      if (d.supplier_name) setSupplierName(d.supplier_name);
      if (d.document_date) setDocumentDate(d.document_date);
      if (d.document_number) setDocumentNumber(d.document_number);
      toast.success("Documento analizzato! Controlla e completa i dati.");
    } catch (err: any) {
      toast.error(err.message ?? "Errore OCR");
    } finally {
      setOcrLoading(false);
    }
  }

  async function save() {
    if (!productName) return toast.error("Nome prodotto obbligatorio");
    const { data: { user } } = await supabase.auth.getUser();
    let imageUrl: string | null = null;
    if (imageFile) {
      const path = `${user!.id}/${Date.now()}-${imageFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, imageFile);
      if (!upErr) imageUrl = path;
    }
    const { error } = await supabase.from("raw_materials").insert({
      user_id: user!.id,
      supplier_name: supplierName || null,
      document_date: documentDate || null,
      document_number: documentNumber || null,
      product_name: productName,
      supplier_lot: supplierLot || null,
      internal_lot: internalLot,
      quantity: quantity || null,
      expiry_date: expiry || null,
      document_image_url: imageUrl,
    });
    if (error) return toast.error(error.message);
    toast.success(`Registrato • Lotto ${internalLot}`);
    setProductName("");
    setSupplierLot("");
    setQuantity("");
    setExpiry("");
    setInternalLot(generateInternalLot("L"));
    setPreview(null);
    setImageFile(null);
    load();
  }

  async function toggleStock(id: string, value: boolean) {
    await supabase.from("raw_materials").update({ is_out_of_stock: value }).eq("id", id);
    load();
  }

  return (
    <>
      <PageHeader title="Ingresso Merci" subtitle="Scatta una foto del documento: l'AI compila il resto." />

      <Card className="p-5 mb-6 shadow-soft">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        <div className="grid lg:grid-cols-[180px_1fr] gap-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-2xl bg-gradient-accent text-accent-foreground flex flex-col items-center justify-center gap-2 shadow-elevated hover:opacity-95 transition overflow-hidden relative"
          >
            {preview ? (
              <img src={preview} alt="Doc" className="absolute inset-0 w-full h-full object-cover" />
            ) : ocrLoading ? (
              <>
                <Loader2 className="animate-spin" size={32} />
                <span className="text-xs font-medium">Analisi AI…</span>
              </>
            ) : (
              <>
                <Camera size={32} />
                <span className="text-xs font-medium text-center px-2">Scatta foto<br />fattura/DDT</span>
              </>
            )}
          </button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Sparkles size={12} className="text-accent" /> Fornitore</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Sparkles size={12} className="text-accent" /> Data documento</Label>
              <Input type="date" value={documentDate} onChange={(e) => setDocumentDate(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="flex items-center gap-1"><Sparkles size={12} className="text-accent" /> Numero documento</Label>
              <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome prodotto *</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Mozzarella fior di latte" />
            </div>
            <div className="space-y-1.5">
              <Label>Lotto fornitore</Label>
              <Input value={supplierLot} onChange={(e) => setSupplierLot(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Lotto interno</Label>
              <Input value={internalLot} readOnly className="font-mono bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantità</Label>
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="5 kg" />
            </div>
            <div className="space-y-1.5">
              <Label>Scadenza</Label>
              <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          </div>
        </div>
        <Button onClick={save} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <Package size={16} /> Registra ingresso
        </Button>
      </Card>

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold truncate">{r.product_name}</div>
              <div className="text-xs text-muted-foreground">
                {r.supplier_name || "—"} • <span className="font-mono">{r.internal_lot}</span>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
              <Checkbox checked={r.is_out_of_stock} onCheckedChange={(v) => toggleStock(r.id, Boolean(v))} />
              Esaurito
            </label>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessuna materia prima registrata.</p>}
      </div>
    </>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.split(",")[1]);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}