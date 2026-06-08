import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Factory, Check, PackageMinus, Archive as ArchiveIcon, ChevronDown } from "lucide-react";
import { generateInternalLot } from "@/lib/lot";
import { Link, useNavigate } from "react-router-dom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { useCurrentStore } from "@/hooks/useCurrentStore";
import { productionLabel, useActivityProfile } from "@/hooks/useActivityProfile";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import Preparations from "@/pages/Preparations";

const CATEGORY_LABELS: Record<string, string> = {
  materia_prima: "Materie Prime",
  aroma: "Aromi",
  additivo_allergene: "Additivi",
};

export default function Production() {
  const { session } = useAuth();
  const { operator } = useOperatorSession();
  const { profile } = useActivityProfile();
  const { store, scaleIntegrationActive } = useCurrentStore();
  const pageLabel = productionLabel(profile);
  const isOperatorAdmin = !session && !!operator?.is_admin && !!operator?.pin;
  const [name, setName] = useState("");
  const [prodDate, setProdDate] = useState(new Date().toISOString().slice(0, 10));
  const [lot, setLot] = useState(generateInternalLot("P", new Date()));
  const [notes, setNotes] = useState("");
  const [productDeptId, setProductDeptId] = useState<string>("");
  const [meatType, setMeatType] = useState<"fresh" | "preparato">("fresh");
  const [preservationType, setPreservationType] = useState<"fresh" | "vacuum">("vacuum");
  const [macelleriaPreservation, setMacelleriaPreservation] = useState<"vaschetta" | "vacuum">("vaschetta");
  const [storageMode, setStorageMode] = useState<"refrigerato" | "abbattuto" | "surgelato">("refrigerato");
  const [requiresBlastChilling, setRequiresBlastChilling] = useState(false);
  const [manualIngredients, setManualIngredients] = useState("");
  // Bilance di reparto (visibile solo se scaleIntegrationActive)
  const [pluCode, setPluCode] = useState("");
  const [filterDeptId, setFilterDeptId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<any[]>([]);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({ "Questa settimana": true, "Settimana scorsa": false });
  const { departments: deptsFromHook } = useDepartments();
  const [operatorDepts, setOperatorDepts] = useState<any[]>([]);
  const allDepartments = isOperatorAdmin ? operatorDepts : deptsFromHook;
  // Per Ristorazione mostra solo il reparto "Cucina"
  const departments = profile === "ristorazione"
    ? allDepartments.filter((d) => d.name?.toLowerCase().trim() === "cucina")
    : allDepartments;
  const navigate = useNavigate();
  const isMacelleria = (depId: string) =>
    departments.find((d) => d.id === depId)?.name?.toLowerCase().trim() === "macelleria";
  const isSalumeria = (depId: string) =>
    departments.find((d) => d.id === depId)?.name?.toLowerCase().trim().startsWith("salum") ?? false;
  const isCucina = (depId: string) =>
    departments.find((d) => d.id === depId)?.name?.toLowerCase().trim() === "cucina";

  // Per Ristorazione: auto-seleziona Cucina appena disponibile
  useEffect(() => {
    if (profile === "ristorazione" && !productDeptId && departments.length > 0) {
      const cucina = departments.find((d) => d.name?.toLowerCase().trim() === "cucina");
      if (cucina) setProductDeptId(cucina.id);
    }
  }, [profile, departments, productDeptId]);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    let m: any[] = [];
    let p: any[] = [];
    if (isOperatorAdmin && operator) {
      const [rmRes, prRes, dpRes] = await Promise.all([
        supabase.rpc("operator_admin_list", { p_operator_id: operator.id, p_pin: operator.pin!, p_table: "raw_materials" }),
        supabase.rpc("operator_admin_list", { p_operator_id: operator.id, p_pin: operator.pin!, p_table: "products" }),
        supabase.rpc("operator_admin_list", { p_operator_id: operator.id, p_pin: operator.pin!, p_table: "departments" }),
      ]);
      const rmJson: any = rmRes.data;
      const prJson: any = prRes.data;
      const dpJson: any = dpRes.data;
      m = (rmJson?.rows ?? []).filter((r: any) => !r.is_out_of_stock);
      p = (prJson?.rows ?? []).filter((r: any) => r.production_date === today);
      setOperatorDepts(dpJson?.rows ?? []);
    } else {
      const [rmRes, prRes] = await Promise.all([
        supabase.from("raw_materials").select("id, product_name, internal_lot, category, is_out_of_stock, created_at, department_id, expiry_date").eq("is_out_of_stock", false).order("created_at", { ascending: false }),
        supabase.from("products").select("*, product_ingredients(raw_materials(product_name, internal_lot))").eq("production_date", today).order("created_at", { ascending: false }),
      ]);
      m = rmRes.data ?? [];
      p = prRes.data ?? [];
    }
    // Hide raw materials older than 2 weeks (only for category materia_prima) e scadute
    const filtered = (m ?? []).filter((it: any) => {
      // Escludi materie prime scadute (expiry_date < oggi)
      if (it.expiry_date && String(it.expiry_date).slice(0, 10) < today) return false;
      if ((it.category || "materia_prima") !== "materia_prima") return true;
      return new Date(it.created_at) >= twoWeeksAgo;
    });
    setMaterials(filtered);
    setRows(p ?? []);
  }
  useEffect(() => { load(); }, [isOperatorAdmin, operator?.id]);

  function toggle(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  async function markOutOfStock(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (isOperatorAdmin) {
      toast.error("Operazione non disponibile in modalità operatore");
      return;
    }
    await supabase.from("raw_materials").update({ is_out_of_stock: true }).eq("id", id);
    toast.success("Segnato come esaurito — aggiunto alla lista acquisti");
    const s = new Set(selected);
    s.delete(id);
    setSelected(s);
    load();
  }

  async function save() {
    if (!isCucina(productDeptId) && !name) return toast.error("Nome prodotto richiesto");
    if (!productDeptId) return toast.error("Seleziona un reparto per il prodotto");
    if (selected.size === 0 && !manualIngredients.trim()) {
      return toast.error("Seleziona almeno un ingrediente o scrivili manualmente");
    }
    const meat_type = isMacelleria(productDeptId) ? meatType : null;
    const preservation_type = isMacelleria(productDeptId)
      ? macelleriaPreservation
      : isSalumeria(productDeptId)
      ? preservationType
      : storageMode;
    const needsBlast = requiresBlastChilling || storageMode === "abbattuto" || storageMode === "surgelato";
    if (isOperatorAdmin && operator) {
      const { data, error } = await supabase.rpc("operator_admin_insert_product", {
        p_operator_id: operator.id,
        p_pin: operator.pin!,
        p_name: name,
        p_production_date: prodDate,
        p_internal_lot: lot,
        p_notes: notes,
        p_department_id: productDeptId,
        p_meat_type: meat_type,
        p_raw_material_ids: Array.from(selected),
        p_preservation_type: preservation_type,
      } as any);
      const res: any = data;
      if (error || !res?.ok) return toast.error(error?.message || res?.error || "Errore");
      toast.success(`Prodotto creato • ${lot}`);
      setName(""); setNotes(""); setSelected(new Set()); setMeatType("fresh"); setPreservationType("vacuum"); setMacelleriaPreservation("vaschetta");
      setRequiresBlastChilling(false); setManualIngredients("");
      setLot(generateInternalLot("P", new Date()));
      load();
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prod, error } = await supabase
      .from("products")
      .insert({
        user_id: user!.id, name, production_date: prodDate, internal_lot: lot, notes,
        department_id: productDeptId, meat_type, preservation_type,
        requires_blast_chilling: needsBlast,
        manual_ingredients: manualIngredients.trim() || null,
      } as any)
      .select()
      .single();
    if (error) return toast.error(error.message);
    if (selected.size > 0) {
      const ingredients = Array.from(selected).map((rm) => ({
        product_id: prod.id,
        raw_material_id: rm,
        user_id: user!.id,
      }));
      await supabase.from("product_ingredients").insert(ingredients);
    }
    // Coda bilance: inserisce solo se l'integrazione è attiva e PLU è compilato
    if (scaleIntegrationActive && store && pluCode.trim()) {
      const selectedNames = Array.from(selected)
        .map((id) => materials.find((m: any) => m.id === id)?.product_name)
        .filter(Boolean)
        .join(", ");
      const combinedIngredients = [
        selectedNames,
        manualIngredients.trim(),
      ].filter(Boolean).join(", ") || null;
      const { error: qErr } = await supabase.from("scales_queue").insert({
        user_id: user!.id,
        store_id: store.id,
        plu_code: pluCode.trim(),
        product_name: name,
        lot_number: lot,
        ingredients: combinedIngredients,
      } as any);
      if (qErr) toast.error(`Coda bilance: ${qErr.message}`);
      else toast.success("Inviato alla coda bilance");
    }
    if (needsBlast) {
      await (supabase as any).from("blast_chillings").insert({
        user_id: user!.id,
        product_name: name,
        cycle_type: storageMode === "surgelato" ? "negative" : "positive",
        outcome: "ok",
        notes: `Da completare (${storageMode}) — generato da ${pageLabel} • Lotto ${lot}`,
        product_id: prod.id,
      });
      toast.success(`Creato • Abbattimento da completare in Archivio`);
    } else {
      toast.success(`Creato • ${lot}`);
    }
    setName("");
    setNotes("");
    setSelected(new Set());
    setMeatType("fresh");
    setPreservationType("vacuum");
    setMacelleriaPreservation("vaschetta");
    setStorageMode("refrigerato");
    setRequiresBlastChilling(false);
    setManualIngredients("");
    setPluCode("");
    setLot(generateInternalLot("P", new Date()));
    load();
  }

  // Filter materials by selected department (when set)
  const q = searchQuery.trim().toLowerCase();
  const visibleMaterials = materials.filter((m: any) => {
    if (filterDeptId && m.department_id !== filterDeptId) return false;
    if (q) {
      const name = (m.product_name || "").toLowerCase();
      const lot = (m.internal_lot || "").toLowerCase();
      const ing = (m.ingredients || "").toLowerCase();
      if (!name.includes(q) && !lot.includes(q) && !ing.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader title={pageLabel} subtitle={profile === "ristorazione" ? "Crea e archivia le ricette di cucina" : "Crea semilavorati e prodotti finiti con tracciabilità ingredienti"} />

      <div className="mb-4">
        <Button asChild variant="outline" className="gap-2">
          <Link to="/archivio?tab=products"><ArchiveIcon size={16} /> Archivio Prodotti</Link>
        </Button>
      </div>

      <Card className="p-5 mb-6 shadow-soft">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Reparto *</Label>
            <Select value={productDeptId} onValueChange={setProductDeptId}>
              <SelectTrigger><SelectValue placeholder={departments.length === 0 ? "Crea reparto in Impostazioni" : "Seleziona reparto"} /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isCucina(productDeptId) && (
          <div className="space-y-2">
            <Label>Nome prodotto</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ragù della casa" />
          </div>
          )}
          {!isCucina(productDeptId) && (
          <>
          <div className="space-y-2">
            <Label>Data produzione</Label>
            <Input type="date" value={prodDate} onChange={(e) => {
              setProdDate(e.target.value);
              if (e.target.value) setLot(generateInternalLot("P", new Date(e.target.value + "T00:00:00")));
            }} />
          </div>
          <div className="space-y-2">
            <Label>Lotto interno</Label>
            <Input value={lot} readOnly className="font-mono bg-muted" />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Note</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          </>
          )}
        </div>

        {isCucina(productDeptId) ? (
          <div className="mt-4">
            <Preparations embedded departmentId={productDeptId} />
          </div>
        ) : (
        <>

        {isMacelleria(productDeptId) && (
          <div className="mt-4 p-3 rounded-md bg-orange-50 border border-orange-200 space-y-2">
            <Label className="text-xs font-semibold text-orange-900">Tipo prodotto Macelleria *</Label>
            <Select value={meatType} onValueChange={(v: "fresh" | "preparato") => setMeatType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fresh">Carne Fresca (Monocomponente)</SelectItem>
                <SelectItem value="preparato">Preparato / Trasformato (Multicomponente)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-orange-900/80">
              {meatType === "fresh"
                ? "In etichetta: Nato in / Allevato in / Macellato in + Bollo CE."
                : "In etichetta: stringa semplificata con origine prevalente (es. \"Carni suine origine: UE\")."}
            </p>
            <div className="pt-2">
              <Label className="text-xs font-semibold text-orange-900">Confezionamento *</Label>
              <Select value={macelleriaPreservation} onValueChange={(v: "vaschetta" | "vacuum") => setMacelleriaPreservation(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vaschetta">In vaschetta</SelectItem>
                  <SelectItem value="vacuum">Sottovuoto</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-orange-900/80 mt-1">
                Default <strong>vaschetta</strong>. Seleziona <strong>sottovuoto</strong> solo se il prodotto viene confezionato sottovuoto.
              </p>
            </div>
          </div>
        )}

        {isSalumeria(productDeptId) && (
          <div className="mt-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 space-y-2">
            <Label className="text-xs font-semibold text-emerald-900">Tipo conservazione *</Label>
            <Select value={preservationType} onValueChange={(v: "fresh" | "vacuum") => setPreservationType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vacuum">Sottovuoto</SelectItem>
                <SelectItem value="fresh">Fresco</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-emerald-900/80">
              La scadenza in etichetta verrà calcolata in base ai giorni configurati in <strong>Impostazioni → Logiche → Salumeria</strong> per il tipo selezionato. Potrai comunque cambiarla al momento della stampa.
            </p>
          </div>
        )}

        {/* Tipo conservazione del prodotto finito */}
        <div className="mt-4 p-3 rounded-md bg-sky-50 border border-sky-200 space-y-2">
          <Label className="text-xs font-semibold text-sky-900">Tipo conservazione *</Label>
          <Select value={storageMode} onValueChange={(v: "refrigerato" | "abbattuto" | "surgelato") => setStorageMode(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="refrigerato">A temperatura (refrigerato 0-4°C)</SelectItem>
              <SelectItem value="abbattuto">Abbattuto (ciclo positivo)</SelectItem>
              <SelectItem value="surgelato">Surgelato (ciclo negativo -18°C)</SelectItem>
            </SelectContent>
          </Select>
          {(storageMode === "abbattuto" || storageMode === "surgelato") && (
            <p className="text-[11px] text-sky-900/80">
              Al salvataggio verrà creata una voce in <strong>Abbattimenti</strong> da completare con temperature di inizio/fine e tempo ciclo.
            </p>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <Label className="text-xs">Ingredienti scritti a mano (opzionale)</Label>
          <Textarea
            value={manualIngredients}
            onChange={(e) => setManualIngredients(e.target.value)}
            placeholder="Es. pomodoro, basilico, olio EVO, sale… (puoi anche selezionare ingredienti dalla lista qui sotto)"
            className="min-h-[70px]"
          />
        </div>

        {scaleIntegrationActive && (
          <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">⚖️</span>
              <div>
                <div className="font-semibold text-sm">Bilance di reparto</div>
                <div className="text-[11px] text-muted-foreground">
                  Punto vendita: <strong>{store?.name}</strong> — questi dati saranno messi in coda per la sincronizzazione con le bilance.
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Codice PLU bilancia</Label>
              <Input
                value={pluCode}
                onChange={(e) => setPluCode(e.target.value)}
                placeholder="es. 1042"
                className="font-mono"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              La riga verrà aggiunta solo se compili il codice PLU. Il lotto inviato sarà quello interno del prodotto (<span className="font-mono">{lot}</span>).
            </p>
          </div>
        )}

        <div className="mt-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <Label>Ingredienti</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterDeptId("")}
                className={`text-xs px-3 py-1 rounded-full border transition ${filterDeptId === "" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"}`}
              >
                Tutti
              </button>
              {departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setFilterDeptId(d.id)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${filterDeptId === d.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"}`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-2">
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca ingrediente per nome, lotto o sigla..."
              className="h-9"
            />
          </div>
          <div className="max-h-80 overflow-auto rounded-lg border border-border p-2 space-y-3 bg-muted/30">
            {visibleMaterials.length === 0 && <p className="text-sm text-muted-foreground p-3">Nessun ingrediente disponibile{filterDeptId ? " per questo reparto" : ""}. Aggiungi dal registro merci o dalle impostazioni.</p>}
            {(["materia_prima", "aroma", "additivo_allergene"] as const).map((cat) => {
              const items = visibleMaterials.filter((m: any) => (m.category || "materia_prima") === cat);
              if (items.length === 0) return null;
              if (cat === "materia_prima") {
                // Group by ISO week
                const startOfWeek = (d: Date) => {
                  const x = new Date(d);
                  const day = (x.getDay() + 6) % 7; // Monday = 0
                  x.setHours(0, 0, 0, 0);
                  x.setDate(x.getDate() - day);
                  return x;
                };
                const today = new Date();
                const thisWeekStart = startOfWeek(today);
                const lastWeekStart = new Date(thisWeekStart);
                lastWeekStart.setDate(lastWeekStart.getDate() - 7);
                const groups: { label: string; items: any[] }[] = [
                  { label: "Questa settimana", items: [] },
                  { label: "Settimana scorsa", items: [] },
                ];
                items.forEach((it: any) => {
                  const d = new Date(it.created_at);
                  if (d >= thisWeekStart) groups[0].items.push(it);
                  else if (d >= lastWeekStart) groups[1].items.push(it);
                });
                return (
                  <div key={cat}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">{CATEGORY_LABELS[cat]}</div>
                    {groups.map((g) => g.items.length === 0 ? null : (
                      <Collapsible
                        key={g.label}
                        open={openWeeks[g.label] ?? false}
                        onOpenChange={(o) => setOpenWeeks((prev) => ({ ...prev, [g.label]: o }))}
                        className="mb-2"
                      >
                        <CollapsibleTrigger className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-card transition text-left">
                          <span className="text-[11px] font-medium text-muted-foreground">{g.label} ({g.items.length})</span>
                          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${openWeeks[g.label] ? "rotate-180" : ""}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-1 pt-1">
                          {g.items.map((m: any) => {
                            const on = selected.has(m.id);
                            return (
                              <div key={m.id} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition ${on ? "bg-primary text-primary-foreground" : "hover:bg-card"}`}>
                                <button type="button" onClick={() => toggle(m.id)} className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary-foreground border-primary-foreground" : "border-border"}`}>
                                    {on && <Check size={14} className="text-primary" />}
                                  </div>
                                  <span className="flex-1 text-sm truncate">{m.product_name}</span>
                                  <span className="text-[10px] opacity-60 whitespace-nowrap">{new Date(m.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}</span>
                                  <span className="font-mono text-xs opacity-70">{m.internal_lot}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => markOutOfStock(m.id, e)}
                                  className={`shrink-0 p-1 rounded hover:bg-destructive/20 transition ${on ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"}`}
                                  title="Segna esaurito"
                                >
                                  <PackageMinus size={16} />
                                </button>
                              </div>
                            );
                          })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                );
              }
              return (
                <div key={cat}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">{CATEGORY_LABELS[cat]}</div>
                  <div className="space-y-1">
                    {items.map((m: any) => {
                      const on = selected.has(m.id);
                      return (
                        <div key={m.id} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition ${on ? "bg-primary text-primary-foreground" : "hover:bg-card"}`}>
                          <button type="button" onClick={() => toggle(m.id)} className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary-foreground border-primary-foreground" : "border-border"}`}>
                              {on && <Check size={14} className="text-primary" />}
                            </div>
                            <span className="flex-1 text-sm truncate">{m.product_name}</span>
                            <span className="text-[10px] opacity-60 whitespace-nowrap">{new Date(m.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}</span>
                            <span className="font-mono text-xs opacity-70">{m.internal_lot}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => markOutOfStock(m.id, e)}
                            className={`shrink-0 p-1 rounded hover:bg-destructive/20 transition ${on ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-destructive"}`}
                            title="Segna esaurito"
                          >
                            <PackageMinus size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={save} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <Factory size={16} /> Crea prodotto
        </Button>
        </>
        )}
      </Card>

      {!isCucina(productDeptId) && (
      <div className="space-y-2">
        {rows.map((p) => (
          <Link key={p.id} to={`/archivio/prodotto/${p.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
            <Card className="p-4 hover:shadow-md transition cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.production_date} • <span className="font-mono">{p.internal_lot}</span></div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.product_ingredients?.map((pi: any, i: number) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {pi.raw_materials?.product_name} <span className="font-mono opacity-60">• {pi.raw_materials?.internal_lot}</span>
                  </span>
                ))}
              </div>
            </Card>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessun prodotto creato oggi.</p>}
      </div>
      )}
    </>
  );
}