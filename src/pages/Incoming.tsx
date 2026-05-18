import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Camera, Loader2, Package, Sparkles, Trash2, Plus, Archive as ArchiveIcon, Star, Repeat, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { generateInternalLot } from "@/lib/lot";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { useDepartments } from "@/hooks/useDepartments";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";

const CATEGORIES = [
  { value: "materia_prima", label: "Materia Prima" },
  { value: "aroma", label: "Aroma" },
  { value: "additivo_allergene", label: "Additivo" },
];

type ProductLine = {
  selected: boolean;
  productName: string;
  quantity: string;
  supplierLot: string;
  category: string;
  expiry: string;
  origin: string;
  internalLot: string;
  departmentId: string;
  bornIn: string;
  raisedIn: string;
  slaughteredIn: string;
  slaughterMark: string;
  ingredients: string;
};

function newProductLine(date?: string): ProductLine {
  const d = date ? new Date(date + "T00:00:00") : new Date();
  return {
    selected: true,
    productName: "",
    quantity: "",
    supplierLot: "",
    category: "materia_prima",
    expiry: "",
    origin: "",
    internalLot: generateInternalLot("L", d),
    departmentId: "",
    bornIn: "",
    raisedIn: "",
    slaughteredIn: "",
    slaughterMark: "",
    ingredients: "",
  };
}

export default function Incoming() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const { session } = useAuth();
  const { operator } = useOperatorSession();
  const isOperatorAdmin = !session && !!operator?.is_admin && !!operator?.pin;
  const { departments: deptsFromHook, visibleDepartments: visibleFromHook } = useDepartments();
  const [operatorDepts, setOperatorDepts] = useState<{ id: string; name: string; sort_order: number }[]>([]);
  const departments = isOperatorAdmin ? operatorDepts : deptsFromHook;
  const visibleDepartments = isOperatorAdmin ? operatorDepts : visibleFromHook;

  useEffect(() => {
    if (!isOperatorAdmin) return;
    (async () => {
      const { data, error } = await supabase.rpc("operator_admin_list" as any, {
        p_operator_id: operator!.id,
        p_pin: operator!.pin,
        p_table: "departments",
      });
      const payload = data as { ok: boolean; rows?: any[]; error?: string } | null;
      if (error || !payload?.ok) {
        toast.error(payload?.error ?? error?.message ?? "Errore caricamento reparti");
        return;
      }
      setOperatorDepts((payload.rows ?? []) as any);
    })();
  }, [isOperatorAdmin, operator?.id, operator?.pin]);

  const isMacelleria = (depId: string) =>
    departments.find((d) => d.id === depId)?.name?.toLowerCase().trim() === "macelleria";
  const isOrtofrutta = (depId: string) =>
    departments.find((d) => d.id === depId)?.name?.toLowerCase().trim() === "ortofrutta";
  const isSalumeria = (depId: string) =>
    (departments.find((d) => d.id === depId)?.name?.toLowerCase().trim() ?? "").startsWith("salum");

  const [supplierName, setSupplierName] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [documentNumber, setDocumentNumber] = useState("");
  const [lines, setLines] = useState<ProductLine[]>([newProductLine()]);
  const [rows, setRows] = useState<any[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [recurring, setRecurring] = useState<any[]>([]);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringPicked, setRecurringPicked] = useState<Set<string>>(new Set());
  const [recurringSearch, setRecurringSearch] = useState("");

  // Keep all product lines in sync with the top-level department
  useEffect(() => {
    setLines((prev) => prev.map((l) => ({ ...l, departmentId })));
  }, [departmentId]);

  async function load() {
    if (isOperatorAdmin) {
      const { data } = await supabase.rpc("operator_admin_list" as any, {
        p_operator_id: operator!.id,
        p_pin: operator!.pin,
        p_table: "raw_materials",
      });
      const payload = data as { ok: boolean; rows?: any[] } | null;
      const today = new Date().toISOString().slice(0, 10);
      const todays = (payload?.rows ?? []).filter((r: any) => (r.created_at ?? "").startsWith(today));
      setRows(todays);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("raw_materials")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOperatorAdmin]);

  // Load recurring templates (logged-in admin only)
  useEffect(() => {
    if (isOperatorAdmin) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("recurring_raw_materials")
        .select("*")
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("product_name");
      setRecurring(data ?? []);
    })();
  }, [isOperatorAdmin]);

  function recurringToLine(r: any): ProductLine {
    const d = documentDate ? new Date(documentDate + "T00:00:00") : new Date();
    return {
      selected: true,
      productName: r.product_name ?? "",
      quantity: r.quantity ?? "",
      supplierLot: "",
      category: r.category ?? "materia_prima",
      expiry: "",
      origin: r.origin ?? "",
      internalLot: generateInternalLot("L", d),
      departmentId: r.department_id ?? departmentId ?? "",
      bornIn: r.born_in ?? "",
      raisedIn: r.raised_in ?? "",
      slaughteredIn: r.slaughtered_in ?? "",
      slaughterMark: r.slaughter_mark ?? "",
      ingredients: r.ingredients ?? "",
    };
  }

  async function loadFromRecurring() {
    const picks = recurring.filter((r) => recurringPicked.has(r.id));
    if (picks.length === 0) { setRecurringOpen(false); return; }
    if (picks[0].supplier_name && !supplierName) setSupplierName(picks[0].supplier_name);
    const newLines = picks.map(recurringToLine);
    // Replace lines if the only existing one is empty, otherwise append
    setLines((prev) => {
      const onlyEmpty = prev.length === 1 && !prev[0].productName.trim();
      return onlyEmpty ? newLines : [...prev, ...newLines];
    });
    // Bump usage counters
    await Promise.all(
      picks.map((r) =>
        (supabase as any)
          .from("recurring_raw_materials")
          .update({ use_count: (r.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
          .eq("id", r.id),
      ),
    );
    toast.success(`${picks.length} prodott${picks.length === 1 ? "o" : "i"} caricat${picks.length === 1 ? "o" : "i"} dai ricorrenti`);
    setRecurringPicked(new Set());
    setRecurringSearch("");
    setRecurringOpen(false);
  }

  async function saveLineAsRecurring(line: ProductLine) {
    if (!line.productName.trim()) return toast.error("Inserisci prima il nome prodotto");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      user_id: user.id,
      product_name: line.productName.trim(),
      supplier_name: supplierName.trim() || null,
      category: line.category,
      department_id: line.departmentId || null,
      quantity: line.quantity.trim() || null,
      origin: line.origin.trim() || null,
      ingredients: line.ingredients.trim() || null,
      born_in: line.bornIn.trim() || null,
      raised_in: line.raisedIn.trim() || null,
      slaughtered_in: line.slaughteredIn.trim() || null,
      slaughter_mark: line.slaughterMark.trim() || null,
    };
    const { data, error } = await (supabase as any)
      .from("recurring_raw_materials")
      .insert(payload)
      .select()
      .single();
    if (error) return toast.error(error.message);
    setRecurring((prev) => [data, ...prev]);
    toast.success("Salvato come ricorrente");
  }

  function updateLine(idx: number, patch: Partial<ProductLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function addLine() {
    setLines((prev) => [...prev, newProductLine(documentDate)]);
  }

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
      if (Array.isArray(d.products) && d.products.length > 0) {
        const dateForLot = d.document_date || documentDate;
        setLines(
          d.products.map((p: any) => ({
            selected: true,
            productName: p.product_name || "",
            quantity: p.quantity || "",
            supplierLot: p.supplier_lot || "",
            category: "materia_prima",
            expiry: "",
            origin: p.origin || "",
            internalLot: generateInternalLot("L", new Date(dateForLot + "T00:00:00")),
            departmentId: departmentId || "",
            bornIn: "",
            raisedIn: "",
            slaughteredIn: "",
            slaughterMark: "",
            ingredients: p.ingredients || "",
          }))
        );
        toast.success(`${d.products.length} prodotti trovati! Controlla e completa i dati.`);
      } else {
        toast.success("Documento analizzato! Controlla e completa i dati.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Errore OCR");
    } finally {
      setOcrLoading(false);
    }
  }

  async function save() {
    const validLines = lines.filter((l) => l.selected && l.productName.trim());
    if (validLines.length === 0) return toast.error("Seleziona almeno un prodotto da importare");
    const missingDept = validLines.findIndex((l) => !l.departmentId);
    if (missingDept >= 0) {
      return toast.error(`Seleziona un reparto per il prodotto "${validLines[missingDept].productName || `riga ${missingDept + 1}`}"`);
    }
    const missingTrace = validLines.findIndex(
      (l) => isMacelleria(l.departmentId) && (!l.bornIn.trim() || !l.raisedIn.trim() || !l.slaughteredIn.trim() || !l.slaughterMark.trim()),
    );
    if (missingTrace >= 0) {
      const l = validLines[missingTrace];
      const missing = [
        !l.bornIn.trim() && "Nato in",
        !l.raisedIn.trim() && "Allevato in",
        !l.slaughteredIn.trim() && "Macellato in",
        !l.slaughterMark.trim() && "Bollo CE",
      ].filter(Boolean).join(", ");
      return toast.error(`Macelleria — "${l.productName}": manca ${missing}`);
    }
    if (departments.length === 0) return toast.error("Crea prima un reparto in Impostazioni");

    if (isOperatorAdmin) {
      const rowsToInsert = validLines.map((l) => ({
        supplier_name: supplierName,
        document_date: documentDate,
        document_number: documentNumber,
        product_name: l.productName,
        supplier_lot: l.supplierLot,
        internal_lot: l.internalLot,
        quantity: l.quantity,
        expiry_date: l.expiry,
        origin: l.origin,
        category: l.category,
        department_id: l.departmentId,
        born_in: isMacelleria(l.departmentId) ? l.bornIn.trim() : "",
        raised_in: isMacelleria(l.departmentId) ? l.raisedIn.trim() : "",
        slaughtered_in: isMacelleria(l.departmentId) ? l.slaughteredIn.trim() : "",
        slaughter_mark: isMacelleria(l.departmentId) ? l.slaughterMark.trim() : "",
        ingredients: isSalumeria(l.departmentId) ? l.ingredients.trim() : "",
      }));
      const { data, error } = await supabase.rpc("operator_admin_insert_raw_materials" as any, {
        p_operator_id: operator!.id,
        p_pin: operator!.pin,
        p_rows: rowsToInsert,
      });
      const payload = data as { ok: boolean; count?: number; error?: string } | null;
      if (error || !payload?.ok) return toast.error(payload?.error ?? error?.message ?? "Errore");
      toast.success(`${payload.count ?? validLines.length} prodott${(payload.count ?? validLines.length) === 1 ? "o registrato" : "i registrati"}`);
      setSupplierName("");
      setDocumentDate(new Date().toISOString().slice(0, 10));
      setDocumentNumber("");
      setDepartmentId("");
      setLines([newProductLine()]);
      setPreview(null);
      setImageFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    let imageUrl: string | null = null;
    if (imageFile) {
      const path = `${user!.id}/${Date.now()}-${imageFile.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, imageFile);
      if (!upErr) imageUrl = path;
    }
    const inserts = validLines.map((l) => ({
      user_id: user!.id,
      supplier_name: supplierName || null,
      document_date: documentDate || null,
      document_number: documentNumber || null,
      product_name: l.productName,
      supplier_lot: l.supplierLot || null,
      internal_lot: l.internalLot,
      quantity: l.quantity || null,
      expiry_date: l.expiry || null,
      origin: l.origin || null,
      document_image_url: imageUrl,
      category: l.category,
      department_id: l.departmentId,
      meat_type: null,
      born_in: isMacelleria(l.departmentId) ? l.bornIn.trim() : null,
      raised_in: isMacelleria(l.departmentId) ? l.raisedIn.trim() : null,
      slaughtered_in: isMacelleria(l.departmentId) ? l.slaughteredIn.trim() : null,
      slaughter_mark: isMacelleria(l.departmentId) ? l.slaughterMark.trim() : null,
      ingredients: isSalumeria(l.departmentId) ? (l.ingredients.trim() || null) : null,
    }));
    const { error } = await supabase.from("raw_materials").insert(inserts);
    if (error) return toast.error(error.message);
    toast.success(`${validLines.length} prodott${validLines.length === 1 ? "o registrato" : "i registrati"}`);
    setSupplierName("");
    setDocumentDate(new Date().toISOString().slice(0, 10));
    setDocumentNumber("");
    setDepartmentId("");
    setLines([newProductLine()]);
    setPreview(null);
    setImageFile(null);
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function toggleStock(id: string, value: boolean) {
    if (isOperatorAdmin) {
      toast.error("Operazione non disponibile in modalità operatore");
      return;
    }
    await supabase.from("raw_materials").update({ is_out_of_stock: value }).eq("id", id);
    load();
  }

  return (
    <>
      <PageHeader title="Ingresso Merci" subtitle="Scatta una foto del documento: l'AI compila il resto." />

      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/archivio"><ArchiveIcon size={16} /> Archivio Materie Prime</Link>
          </Button>
          {!isOperatorAdmin && (
            <Popover open={recurringOpen} onOpenChange={setRecurringOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Repeat size={16} /> Carica da ricorrente
                  {recurring.length > 0 && <span className="text-xs text-muted-foreground">({recurring.length})</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[340px] p-2" align="start">
                {recurring.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Nessun prodotto ricorrente. Crealo in Impostazioni → Ricorrenti, oppure salva una riga con la stella.
                  </div>
                ) : (
                  <>
                    <Input
                      autoFocus
                      placeholder="Cerca prodotto…"
                      value={recurringSearch}
                      onChange={(e) => setRecurringSearch(e.target.value)}
                      className="h-9 mb-2"
                    />
                    <div className="max-h-64 overflow-auto space-y-1">
                      {recurring
                        .filter((r) => {
                          const q = recurringSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (r.product_name || "").toLowerCase().includes(q)
                            || (r.supplier_name || "").toLowerCase().includes(q);
                        })
                        .map((r) => {
                          const on = recurringPicked.has(r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                const s = new Set(recurringPicked);
                                on ? s.delete(r.id) : s.add(r.id);
                                setRecurringPicked(s);
                              }}
                              className={`w-full text-left px-2 py-2 rounded-md flex items-center gap-2 transition ${on ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}`}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary" : "border-border"}`}>
                                {on && <Check size={12} className="text-primary-foreground" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{r.product_name}</div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {r.supplier_name || "—"}
                                  {r.use_count > 0 && <> • {r.use_count}×</>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                    <div className="flex gap-2 mt-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => { setRecurringPicked(new Set()); setRecurringOpen(false); }}>Annulla</Button>
                      <Button size="sm" className="flex-1 bg-gradient-primary" disabled={recurringPicked.size === 0} onClick={loadFromRecurring}>
                        Carica {recurringPicked.size > 0 ? `(${recurringPicked.size})` : ""}
                      </Button>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <Card className="p-5 mb-6 shadow-soft">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        {/* Top-level department selector — drives OCR & loading logic */}
        <Card className="mb-4 p-3 bg-accent/10 border-dashed">
          <Label className="text-xs font-semibold mb-1.5 block">Reparto *</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger><SelectValue placeholder={visibleDepartments.length === 0 ? "Abilita un reparto in Impostazioni" : "Seleziona reparto"} /></SelectTrigger>
            <SelectContent>
              {visibleDepartments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Seleziona prima il reparto: condiziona la lettura della foto e le logiche di caricamento (es. tracciabilità carne per Macelleria).
          </p>
        </Card>
        <div className="grid lg:grid-cols-[180px_1fr] gap-5">
          <button
            type="button"
            onClick={() => {
              if (!departmentId) { toast.error("Seleziona prima il reparto"); return; }
              fileRef.current?.click();
            }}
            disabled={!departmentId && !preview}
            className="aspect-square rounded-2xl bg-gradient-accent text-accent-foreground flex flex-col items-center justify-center gap-2 shadow-elevated hover:opacity-95 transition overflow-hidden relative disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {preview ? (
              <>
                <img src={preview} alt="Doc" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-1 left-1 right-1 flex gap-1 z-10">
                  <span
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                    className="flex-1 text-[10px] font-semibold bg-background/80 backdrop-blur rounded-md py-1 text-center cursor-pointer hover:bg-background/95 transition"
                  >
                    📷 Riscatta
                  </span>
                </div>
              </>
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
              <Input type="date" value={documentDate} onChange={(e) => {
                setDocumentDate(e.target.value);
                if (e.target.value) {
                  const newDate = new Date(e.target.value + "T00:00:00");
                  setLines((prev) => prev.map((l) => ({ ...l, internalLot: generateInternalLot("L", newDate) })));
                }
              }} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="flex items-center gap-1"><Sparkles size={12} className="text-accent" /> Numero documento</Label>
              <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Product lines */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Prodotti ({lines.length})</Label>
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1">
              <Plus size={14} /> Aggiungi riga
            </Button>
          </div>
          {lines.map((line, idx) => (
            <Card key={idx} className={`p-3 border-dashed transition ${line.selected ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-dashed">
                <Checkbox
                  id={`sel-${idx}`}
                  checked={line.selected}
                  onCheckedChange={(v) => updateLine(idx, { selected: !!v })}
                />
                <Label htmlFor={`sel-${idx}`} className="text-xs font-semibold cursor-pointer flex-1">
                  Importa in archivio
                </Label>
                {!isOperatorAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => saveLineAsRecurring(line)}
                    title="Salva come prodotto ricorrente"
                  >
                    <Star size={14} /> Ricorrente
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Prodotto *</Label>
                  <Input value={line.productName} onChange={(e) => updateLine(idx, { productName: e.target.value })} placeholder="Mozzarella fior di latte" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantità</Label>
                  <Input value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} placeholder="5 kg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={line.category} onValueChange={(v) => updateLine(idx, { category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lotto fornitore</Label>
                  <Input value={line.supplierLot} onChange={(e) => updateLine(idx, { supplierLot: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lotto interno</Label>
                  <Input value={line.internalLot} readOnly className="font-mono bg-muted text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Scadenza</Label>
                  <Input type="date" value={line.expiry} onChange={(e) => updateLine(idx, { expiry: e.target.value })} />
                </div>
                {isOrtofrutta(line.departmentId) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Origine</Label>
                    <Input value={line.origin} onChange={(e) => updateLine(idx, { origin: e.target.value })} placeholder="Italia…" />
                  </div>
                )}
              </div>
              {isSalumeria(line.departmentId) && (
                <div className="mt-3 p-3 rounded-md bg-rose-50 border border-rose-200 space-y-2">
                  <Label className="text-xs font-semibold text-rose-900">Ingredienti (prodotto lavorato)</Label>
                  <textarea
                    value={line.ingredients}
                    onChange={(e) => updateLine(idx, { ingredients: e.target.value })}
                    placeholder="Es. carne di suino, sale, spezie, aromi naturali, destrosio, antiossidante: E301…"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-[11px] text-muted-foreground">Inserisci la lista ingredienti come riportata in etichetta. L'OCR estrae solo gli ingredienti in italiano.</p>
                </div>
              )}
              {isMacelleria(line.departmentId) && (
                <div className="mt-3 p-3 rounded-md bg-orange-50 border border-orange-200 space-y-2">
                  <Label className="text-xs font-semibold text-orange-900">Tracciabilità carne (obbligatoria)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nato in *</Label>
                      <Input value={line.bornIn} onChange={(e) => updateLine(idx, { bornIn: e.target.value })} placeholder="Italia" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Allevato in *</Label>
                      <Input value={line.raisedIn} onChange={(e) => updateLine(idx, { raisedIn: e.target.value })} placeholder="Italia" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Macellato in *</Label>
                      <Input value={line.slaughteredIn} onChange={(e) => updateLine(idx, { slaughteredIn: e.target.value })} placeholder="Italia" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bollo CE *</Label>
                      <Input value={line.slaughterMark} onChange={(e) => updateLine(idx, { slaughterMark: e.target.value })} placeholder="IT 1234 L CE" />
                    </div>
                  </div>
                </div>
              )}
              {lines.length > 1 && (
                <Button type="button" variant="ghost" size="sm" className="mt-2 text-destructive gap-1" onClick={() => removeLine(idx)}>
                  <Trash2 size={14} /> Rimuovi
                </Button>
              )}
            </Card>
          ))}
        </div>

        <Button onClick={save} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <Package size={16} /> Registra {lines.length > 1 ? `${lines.length} prodotti` : "ingresso"}
        </Button>
      </Card>

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold truncate">{r.product_name}</div>
              <div className="text-xs text-muted-foreground">
                {r.supplier_name || "—"} • <span className="font-mono">{r.internal_lot}</span>
                {r.origin && <> • Origine: {r.origin}</>}
                {r.category && r.category !== "materia_prima" && (
                  <> • <span className="font-semibold">{CATEGORIES.find(c => c.value === r.category)?.label ?? r.category}</span></>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
              <Checkbox checked={r.is_out_of_stock} onCheckedChange={(v) => toggleStock(r.id, Boolean(v))} />
              Esaurito
            </label>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessuna materia prima registrata oggi.</p>}
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