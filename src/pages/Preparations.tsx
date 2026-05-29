import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import OperatorPinDialog from "@/components/OperatorPinDialog";
import PrintLabelDialog from "@/components/kitchen/PrintLabelDialog";
import { usePreparations, type Preparation } from "@/hooks/usePreparations";
import { useAllergens } from "@/hooks/useAllergens";
import { useRecurringPreparations, type RecurringPreparation } from "@/hooks/useRecurringPreparations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChefHat, Printer, ShieldCheck, AlertTriangle, Trash2, Repeat, Search, X, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { generateInternalLot } from "@/lib/lot";

const SHELF_DEFAULTS: Record<string, number> = { frigo: 72, freezer: 24 * 30, ambiente: 24 };

type RawMaterialLite = {
  id: string;
  product_name: string;
  internal_lot: string;
  supplier_name: string | null;
  expiry_date: string | null;
  is_out_of_stock: boolean;
};

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function addHoursLocal(base: string, hours: number) {
  const d = new Date(base);
  d.setHours(d.getHours() + hours);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function hoursBetween(from: string, to: string) {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 3600000));
}

export default function Preparations({ embedded = false, departmentId }: { embedded?: boolean; departmentId?: string } = {}) {
  const { allergens } = useAllergens();
  const { rows, reload, remove } = usePreparations();
  const { rows: recurring, save: saveRecurring, touch: touchRecurring, remove: removeRecurring } = useRecurringPreparations();

  const [name, setName] = useState("");
  const [preparedAt, setPreparedAt] = useState(nowLocal());
  const [storage, setStorage] = useState<"frigo" | "freezer" | "ambiente">("frigo");
  const [expiry, setExpiry] = useState(() => addHoursLocal(nowLocal(), SHELF_DEFAULTS.frigo));
  const [allergenIds, setAllergenIds] = useState<string[]>([]);
  const [rawMaterialIds, setRawMaterialIds] = useState<string[]>([]);
  const [ingredientsText, setIngredientsText] = useState("");
  const [notes, setNotes] = useState("");
  const [saveAsRecipe, setSaveAsRecipe] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<string>("");
  const [requiresBlast, setRequiresBlast] = useState(false);

  const [pinOpen, setPinOpen] = useState(false);
  const [printItem, setPrintItem] = useState<Preparation | null>(null);
  const [deleteItem, setDeleteItem] = useState<Preparation | null>(null);

  const [rawMaterials, setRawMaterials] = useState<RawMaterialLite[]>([]);
  const [rmSearch, setRmSearch] = useState("");
  const [rmOpen, setRmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("raw_materials")
        .select("id, product_name, internal_lot, supplier_name, expiry_date, is_out_of_stock")
        .eq("is_out_of_stock", false)
        .order("product_name")
        .limit(500);
      setRawMaterials((data as any) ?? []);
    })();
  }, []);

  const rmMap = useMemo(() => new Map(rawMaterials.map((r) => [r.id, r])), [rawMaterials]);
  const allergenMap = useMemo(() => new Map(allergens.map((a) => [a.id, a.name])), [allergens]);

  function setStorageAndRecalc(s: "frigo" | "freezer" | "ambiente") {
    setStorage(s);
    setExpiry(addHoursLocal(preparedAt, SHELF_DEFAULTS[s]));
  }
  function setPreparedAndRecalc(d: string) {
    setPreparedAt(d);
    setExpiry(addHoursLocal(d, SHELF_DEFAULTS[storage]));
  }
  function toggleAllergen(id: string) {
    setAllergenIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleRawMaterial(id: string) {
    setRawMaterialIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function applyRecipe(id: string) {
    setSelectedRecipe(id);
    if (!id) return;
    const r = recurring.find((x) => x.id === id);
    if (!r) return;
    setName(r.name);
    setStorage(r.storage_type);
    setAllergenIds(r.allergen_ids ?? []);
    setRawMaterialIds(r.raw_material_ids ?? []);
    setIngredientsText(r.ingredients_text ?? "");
    setNotes(r.notes ?? "");
    const n = nowLocal();
    setPreparedAt(n);
    setExpiry(addHoursLocal(n, r.shelf_hours || SHELF_DEFAULTS[r.storage_type]));
    toast.success(`Ricetta "${r.name}" caricata`);
  }

  function reset() {
    setName(""); setNotes(""); setAllergenIds([]); setRawMaterialIds([]); setIngredientsText("");
    setSaveAsRecipe(false); setSelectedRecipe("");
    setRequiresBlast(false);
    const n = nowLocal();
    setPreparedAt(n);
    setExpiry(addHoursLocal(n, SHELF_DEFAULTS[storage]));
  }

  function handleSave() {
    if (!name) return toast.error("Indica il nome della preparazione");
    setPinOpen(true);
  }

  async function saveWithOperator(op: { id: string; name: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessione scaduta");
    if (!storage) return toast.error("Indica il tipo di conservazione");
    const lot = generateInternalLot("R", new Date(preparedAt));
    const holdingMode: "hot" | "cold" = storage === "ambiente" ? "hot" : "cold";
    const cycleType: "positive" | "negative" = storage === "freezer" ? "negative" : "positive";
    const labelName = `${name} • Lotto ${lot}`;
    const { error } = await supabase.from("preparations" as any).insert({
      user_id: user.id,
      operator_id: op.id,
      name,
      prepared_at: new Date(preparedAt).toISOString(),
      internal_expiry: new Date(expiry).toISOString(),
      storage_type: storage,
      allergen_ids: allergenIds,
      raw_material_ids: rawMaterialIds,
      ingredients_text: ingredientsText || null,
      notes: notes ? `${notes} • Lotto ${lot}` : `Lotto ${lot}`,
    });
    if (error) return toast.error(error.message);

    // Se la lavorazione proviene dal reparto Cucina, registra anche un record
    // in `products` cosi compare in Archivio Generale → Lavorazioni/Ricette
    // come per gli altri reparti.
    if (departmentId) {
      try {
        await (supabase as any).from("products").insert({
          user_id: user.id,
          operator_id: op.id,
          name,
          production_date: new Date(preparedAt).toISOString().slice(0, 10),
          internal_lot: lot,
          department_id: departmentId,
          preservation_type: storage === "freezer" ? "surgelato" : storage === "ambiente" ? "fresh" : "refrigerato",
          requires_blast_chilling: requiresBlast,
          manual_ingredients: ingredientsText || null,
          notes: notes || null,
        });
      } catch {
        // non bloccante: la preparazione è gia stata salvata
      }
    }

    // Apri scheda Abbattimento (se richiesto) o direttamente Mantenimento.
    // Se richiede entrambi, apri solo abbattimento ora; la scheda Mantenimento
    // viene creata automaticamente al completamento dell'abbattimento.
    if (requiresBlast) {
      await (supabase as any).from("blast_chillings").insert({
        user_id: user.id,
        operator_id: op.id,
        product_name: labelName,
        cycle_type: cycleType,
        outcome: "ok",
        started_at: new Date().toISOString(),
        notes: `Da completare — generato da Cucina [CONS:${holdingMode}]`,
      });
      toast.message("Scheda abbattimento aperta", { description: "Completa il ciclo in Abbattimenti." });
    } else {
      await (supabase as any).from("holding_records").insert({
        user_id: user.id,
        operator_id: null,
        product_name: labelName,
        mode: holdingMode,
        outcome: "pending",
        notes: `Da completare — generato da Cucina • Lotto ${lot}`,
      });
      toast.message("Scheda mantenimento aperta", { description: "Da completare in Mantenimento con temperatura e operatore." });
    }

    if (selectedRecipe) {
      try { await touchRecurring(selectedRecipe); } catch {}
    } else if (saveAsRecipe) {
      try {
        await saveRecurring({
          name,
          storage_type: storage,
          shelf_hours: hoursBetween(preparedAt, expiry),
          allergen_ids: allergenIds,
          raw_material_ids: rawMaterialIds,
          ingredients_text: ingredientsText || null,
          notes: notes || null,
        });
        toast.success("Ricetta salvata tra le ricorrenti");
      } catch (e: any) { toast.error(e.message); }
    }

    toast.success(`Preparazione registrata da ${op.name}`);
    reset();
    reload();
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    try {
      await remove(deleteItem.id);
      toast.success("Preparazione eliminata");
    } catch (e: any) {
      toast.error(e.message || "Errore durante l'eliminazione");
    } finally {
      setDeleteItem(null);
    }
  }

  async function deleteRecipe(r: RecurringPreparation) {
    if (!confirm(`Eliminare la ricetta "${r.name}"?`)) return;
    try { await removeRecurring(r.id); toast.success("Ricetta eliminata"); }
    catch (e: any) { toast.error(e.message); }
  }

  const filteredRm = rawMaterials.filter((r) =>
    !rmSearch || r.product_name.toLowerCase().includes(rmSearch.toLowerCase())
  );

  return (
    <>
      {!embedded && (
        <PageHeader title="Mise en place" subtitle="Preparati interni con ingredienti tracciati, allergeni e ricette ricorrenti" />
      )}

      <Card className="p-5 shadow-soft mb-6">
        {/* Ricetta ricorrente */}
        {recurring.length > 0 && (
          <div className="mb-5 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
              <Repeat size={14} /> Ricetta ricorrente
            </Label>
            <div className="flex gap-2">
              <Select value={selectedRecipe} onValueChange={applyRecipe}>
                <SelectTrigger><SelectValue placeholder="Scegli una ricetta salvata per precompilare…" /></SelectTrigger>
                <SelectContent>
                  {recurring.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} {r.use_count > 0 && <span className="text-muted-foreground">· usata {r.use_count}×</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRecipe && (
                <Button variant="ghost" size="icon" onClick={() => { setSelectedRecipe(""); reset(); }} title="Annulla selezione">
                  <X size={16} />
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Nome preparazione</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Ragù alla bolognese, maionese, brodo vegetale" />
          </div>
          <div className="space-y-2">
            <Label>Conservazione</Label>
            <Select value={storage} onValueChange={(v: any) => setStorageAndRecalc(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="frigo">Frigorifero (0-4°C)</SelectItem>
                <SelectItem value="freezer">Freezer (-18°C)</SelectItem>
                <SelectItem value="ambiente">Temperatura ambiente</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Obbligatorio. Al salvataggio viene aperta una scheda in <strong>Mantenimento</strong>.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Preparato il</Label>
            <Input type="datetime-local" value={preparedAt} onChange={(e) => setPreparedAndRecalc(e.target.value)} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Scadenza interna</Label>
            <Input type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            <p className="text-xs text-muted-foreground">Default: frigo 72h, freezer 30gg, ambiente 24h — modificabile.</p>
          </div>

          {/* Materie prime tracciate */}
          <div className="space-y-2 lg:col-span-2">
            <Label className="flex items-center gap-1.5">
              <BookMarked size={12} /> Ingredienti tracciati (materie prime in ingresso)
            </Label>
            <Popover open={rmOpen} onOpenChange={setRmOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2 font-normal">
                  <Search size={14} />
                  {rawMaterialIds.length === 0 ? "Cerca e aggiungi materie prime…" : `${rawMaterialIds.length} materie prime selezionate`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(520px,90vw)] p-0" align="start">
                <div className="p-2 border-b">
                  <Input autoFocus placeholder="Cerca per nome prodotto…" value={rmSearch} onChange={(e) => setRmSearch(e.target.value)} />
                </div>
                <div className="max-h-64 overflow-auto">
                  {filteredRm.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nessuna materia prima.</p>}
                  {filteredRm.map((r) => (
                    <label key={r.id} className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-0">
                      <Checkbox checked={rawMaterialIds.includes(r.id)} onCheckedChange={() => toggleRawMaterial(r.id)} className="mt-0.5" />
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-medium truncate">{r.product_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Lotto {r.internal_lot}
                          {r.supplier_name && <> · {r.supplier_name}</>}
                          {r.expiry_date && <> · scade {new Date(r.expiry_date).toLocaleDateString("it-IT")}</>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {rawMaterialIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {rawMaterialIds.map((id) => {
                  const r = rmMap.get(id);
                  if (!r) return null;
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                      <span>{r.product_name} <span className="opacity-60">· {r.internal_lot}</span></span>
                      <button onClick={() => toggleRawMaterial(id)} className="hover:bg-background rounded p-0.5"><X size={10} /></button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Altri ingredienti (testo libero)</Label>
            <Textarea value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} rows={2}
              placeholder="Sale, pepe, olio EVO, acqua, spezie…" />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label className="flex items-center gap-1"><AlertTriangle size={12} /> Allergeni presenti</Label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-muted/30">
              {allergens.map((a) => (
                <label key={a.id} className="flex items-center gap-1.5 text-sm cursor-pointer px-2 py-1 rounded hover:bg-background">
                  <Checkbox checked={allergenIds.includes(a.id)} onCheckedChange={() => toggleAllergen(a.id)} />
                  <span>{a.name}</span>
                </label>
              ))}
              {allergens.length === 0 && <span className="text-xs text-muted-foreground">Nessun allergene configurato — vai in Impostazioni → Allergeni.</span>}
            </div>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Note</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Es. uso entro 24h una volta scongelato" />
          </div>

          {!selectedRecipe && (
            <div className="lg:col-span-2 flex items-center gap-2 p-3 rounded-lg bg-muted/40">
              <Checkbox id="save-recipe" checked={saveAsRecipe} onCheckedChange={(v) => setSaveAsRecipe(!!v)} />
              <Label htmlFor="save-recipe" className="cursor-pointer text-sm font-normal">
                Salva anche come ricetta ricorrente (la troverai nel menu in alto la prossima volta)
              </Label>
            </div>
          )}

          <div className="lg:col-span-2 flex items-start gap-2 p-3 rounded-lg bg-sky-50 border border-sky-200">
            <Checkbox id="needs-blast" checked={requiresBlast} onCheckedChange={(v) => setRequiresBlast(!!v)} className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="needs-blast" className="cursor-pointer text-sm font-medium text-sky-900">
                Prevede abbattimento
              </Label>
              <p className="text-[11px] text-sky-900/80 mt-0.5">
                Se attivo, al salvataggio viene aperta una scheda in <strong>Abbattimenti</strong> con nome e lotto. La scheda <strong>Mantenimento</strong> verrà creata automaticamente al termine del ciclo.
              </p>
            </div>
          </div>
        </div>
        <Button onClick={handleSave} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <ShieldCheck size={16} /> Identifica e registra
        </Button>
      </Card>

      <OperatorPinDialog open={pinOpen} onOpenChange={setPinOpen} onConfirm={saveWithOperator} title="Chi ha preparato?" />

      {recurring.length > 0 && (
        <Card className="p-4 mb-6">
          <h3 className="font-display font-semibold mb-3 flex items-center gap-2 text-sm">
            <Repeat size={14} /> Ricette salvate ({recurring.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {recurring.map((r) => (
              <Badge key={r.id} variant="outline" className="gap-1.5 pr-1 py-1">
                <span className="text-xs">{r.name}</span>
                <button onClick={() => deleteRecipe(r)} className="hover:bg-destructive/10 rounded p-0.5"><X size={10} /></button>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><ChefHat size={16} /> Preparati attivi</h3>
      <div className="space-y-2">
        {rows.map((r) => {
          const expired = new Date(r.internal_expiry) < new Date();
          const allergenNames = (r.allergen_ids ?? []).map((id) => allergenMap.get(id)).filter(Boolean) as string[];
          const rmNames = (r.raw_material_ids ?? []).map((id) => rmMap.get(id)?.product_name).filter(Boolean) as string[];
          return (
            <Card key={r.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Preparato: {new Date(r.prepared_at).toLocaleString("it-IT")}
                </div>
                <div className="text-xs mt-0.5">
                  Scade: <span className={expired ? "text-destructive font-semibold" : "text-foreground"}>
                    {new Date(r.internal_expiry).toLocaleString("it-IT")}
                  </span>
                </div>
                {(rmNames.length > 0 || r.ingredients_text) && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    Ingredienti: {[...rmNames, r.ingredients_text].filter(Boolean).join(", ")}
                  </div>
                )}
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  <Badge variant="outline">{r.storage_type}</Badge>
                  {allergenNames.length > 0 && <Badge variant="secondary">Allergeni: {allergenNames.join(", ")}</Badge>}
                  {expired && <Badge variant="destructive">Scaduto</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPrintItem(r)}>
                  <Printer size={14} /> Etichetta
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteItem(r)}>
                  <Trash2 size={14} /> Elimina
                </Button>
              </div>
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">Nessun preparato registrato.</p>}
      </div>

      {printItem && (() => {
        const allergenNames = (printItem.allergen_ids ?? []).map((id) => allergenMap.get(id)).filter(Boolean) as string[];
        const rmLines = (printItem.raw_material_ids ?? []).map((id) => {
          const r = rmMap.get(id);
          return r ? `${r.product_name} (lotto ${r.internal_lot})` : null;
        }).filter(Boolean) as string[];
        const ingredientsCombined = [...rmLines, printItem.ingredients_text].filter(Boolean).join(", ");
        return (
          <PrintLabelDialog
            open={!!printItem}
            onOpenChange={(v) => !v && setPrintItem(null)}
            title="Etichetta mise en place"
            productName={printItem.name}
            highlight={allergenNames}
            fields={[
              { label: "Preparato", value: new Date(printItem.prepared_at).toLocaleString("it-IT") },
              { label: "Scadenza", value: new Date(printItem.internal_expiry).toLocaleString("it-IT") },
              { label: "Conserv.", value: printItem.storage_type },
              ...(ingredientsCombined ? [{ label: "Ingredienti", value: ingredientsCombined }] : []),
              ...(allergenNames.length ? [{ label: "Allergeni", value: allergenNames.join(", ") }] : []),
              ...(printItem.notes ? [{ label: "Note", value: printItem.notes }] : []),
            ]}
          />
        );
      })()}

      <AlertDialog open={!!deleteItem} onOpenChange={(v) => !v && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la preparazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Verrà rimossa permanentemente la preparazione <strong>{deleteItem?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteItem(null)}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}