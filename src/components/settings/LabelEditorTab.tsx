import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Save, Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

type FieldConfig = {
  key: string;
  label: string;
  visible: boolean;
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
  width?: number;
  height?: number;
};

type Template = {
  id?: string;
  name: string;
  width_mm: number;
  height_mm: number;
  layout_config: { fields: FieldConfig[] };
  is_default: boolean;
};

const DEFAULT_FIELDS: FieldConfig[] = [
  { key: "company_name", label: "Azienda", visible: true, x: 5, y: 5, fontSize: 12, bold: true },
  { key: "logo", label: "Logo", visible: true, x: 70, y: 2, fontSize: 10, bold: false, width: 25, height: 15 },
  { key: "product_name", label: "Prodotto", visible: true, x: 5, y: 20, fontSize: 14, bold: true },
  { key: "internal_lot", label: "Lotto", visible: true, x: 5, y: 32, fontSize: 10, bold: false },
  { key: "production_date", label: "Data produzione", visible: true, x: 5, y: 40, fontSize: 10, bold: false },
  { key: "expiry_date", label: "Scadenza", visible: true, x: 5, y: 48, fontSize: 10, bold: false },
  { key: "ingredients", label: "Ingredienti", visible: true, x: 5, y: 56, fontSize: 8, bold: false },
  { key: "company_address", label: "Indirizzo", visible: true, x: 5, y: 64, fontSize: 7, bold: false },
];

const SAMPLE_DATA: Record<string, string> = {
  company_name: "La Mia Azienda S.r.l.",
  product_name: "Torta al Cioccolato",
  internal_lot: "LOT-2026-001",
  production_date: "Data prod.: 04/05/2026",
  expiry_date: "Scadenza: 04/06/2026",
  ingredients: "Ingr.: farina, zucchero, cacao, uova, burro",
  company_address: "Via Roma 1, 00100 Roma",
};

const PX_PER_MM = 3.78; // approximate screen px per mm

export default function LabelEditorTab() {
  const [templates, setTemplates] = useState<(Template & { id: string })[]>([]);
  const [current, setCurrent] = useState<Template | null>(null);
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("label_templates").select("*").eq("user_id", user.id).order("created_at");
    const list = (data ?? []).map((d: any) => ({
      id: d.id,
      name: d.name,
      width_mm: Number(d.width_mm),
      height_mm: Number(d.height_mm),
      layout_config: typeof d.layout_config === "string" ? JSON.parse(d.layout_config) : d.layout_config,
      is_default: d.is_default,
    }));
    setTemplates(list);
    if (list.length > 0 && !current) setCurrent(list[0]);
    setLoading(false);
  }

  async function createNew() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("label_templates").insert({
      user_id: user.id,
      name: "Nuova etichetta",
      width_mm: 100,
      height_mm: 70,
      layout_config: { fields: DEFAULT_FIELDS } as any,
      is_default: templates.length === 0,
    });
    if (error) { toast.error("Errore creazione"); return; }
    toast.success("Template creato");
    await load();
  }

  async function save() {
    if (!current?.id) return;
    const { error } = await supabase.from("label_templates").update({
      name: current.name,
      width_mm: current.width_mm,
      height_mm: current.height_mm,
      layout_config: current.layout_config as any,
      is_default: current.is_default,
    }).eq("id", current.id);
    if (error) { toast.error("Errore salvataggio"); return; }
    toast.success("Salvato");
    await load();
  }

  async function remove() {
    if (!current?.id) return;
    await supabase.from("label_templates").delete().eq("id", current.id);
    setCurrent(null);
    toast.success("Eliminato");
    await load();
  }

  function updateField(idx: number, patch: Partial<FieldConfig>) {
    if (!current) return;
    const fields = [...current.layout_config.fields];
    fields[idx] = { ...fields[idx], ...patch };
    setCurrent({ ...current, layout_config: { fields } });
  }

  if (loading) return <div className="py-8 text-center text-muted-foreground">Caricamento…</div>;

  return (
    <div className="space-y-6">
      {/* Template selector */}
      <div className="flex flex-wrap items-center gap-2">
        {templates.map((t) => (
          <Button
            key={t.id}
            variant={current?.id === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => { setCurrent(t); setSelectedField(null); }}
          >
            {t.name}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={createNew} className="gap-1">
          <Plus size={14} /> Nuovo
        </Button>
      </div>

      {!current ? (
        <Card className="p-8 text-center text-muted-foreground">
          Crea un template per iniziare a modellare le etichette.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: settings */}
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <div>
                <Label>Nome template</Label>
                <Input value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Larghezza (mm)</Label>
                  <Input type="number" value={current.width_mm} onChange={(e) => setCurrent({ ...current, width_mm: +e.target.value })} />
                </div>
                <div>
                  <Label>Altezza (mm)</Label>
                  <Input type="number" value={current.height_mm} onChange={(e) => setCurrent({ ...current, height_mm: +e.target.value })} />
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Campi etichetta</h3>
              {current.layout_config.fields.map((f, i) => (
                <div
                  key={f.key}
                  className={`p-3 rounded-md border cursor-pointer transition ${selectedField === i ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  onClick={() => setSelectedField(i)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{f.label}</span>
                    <Switch checked={f.visible} onCheckedChange={(v) => updateField(i, { visible: v })} />
                  </div>
                  {selectedField === i && f.visible && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">X (mm)</Label>
                          <Input type="number" value={f.x} onChange={(e) => updateField(i, { x: +e.target.value })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <Label className="text-xs">Y (mm)</Label>
                          <Input type="number" value={f.y} onChange={(e) => updateField(i, { y: +e.target.value })} className="h-8 text-xs" />
                        </div>
                      </div>
                      {f.key !== "logo" && (
                        <>
                          <div>
                            <Label className="text-xs">Font size (pt): {f.fontSize}</Label>
                            <Slider min={5} max={24} step={1} value={[f.fontSize]} onValueChange={([v]) => updateField(i, { fontSize: v })} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={f.bold} onCheckedChange={(v) => updateField(i, { bold: v })} />
                            <Label className="text-xs">Grassetto</Label>
                          </div>
                        </>
                      )}
                      {f.key === "logo" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Largh. (mm)</Label>
                            <Input type="number" value={f.width ?? 25} onChange={(e) => updateField(i, { width: +e.target.value })} className="h-8 text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs">Alt. (mm)</Label>
                            <Input type="number" value={f.height ?? 15} onChange={(e) => updateField(i, { height: +e.target.value })} className="h-8 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </Card>

            <div className="flex gap-2">
              <Button onClick={save} className="gap-1"><Save size={14} /> Salva</Button>
              <Button variant="destructive" onClick={remove} className="gap-1"><Trash2 size={14} /> Elimina</Button>
            </div>
          </div>

          {/* Right: preview */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1"><Eye size={14} /> Anteprima</h3>
            <div className="border rounded-lg p-4 bg-muted/30 overflow-auto">
              <div
                ref={canvasRef}
                className="relative bg-white border border-dashed border-border mx-auto"
                style={{
                  width: current.width_mm * PX_PER_MM,
                  height: current.height_mm * PX_PER_MM,
                }}
              >
                {current.layout_config.fields.filter((f) => f.visible).map((f) => {
                  if (f.key === "logo") {
                    return (
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
                  return (
                    <div
                      key={f.key}
                      className="absolute text-black whitespace-nowrap"
                      style={{
                        left: f.x * PX_PER_MM,
                        top: f.y * PX_PER_MM,
                        fontSize: f.fontSize * (PX_PER_MM / 2.835),
                        fontWeight: f.bold ? 700 : 400,
                      }}
                    >
                      {SAMPLE_DATA[f.key] ?? f.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {current.width_mm} × {current.height_mm} mm — Anteprima approssimativa
            </p>
          </div>
        </div>
      )}
    </div>
  );
}