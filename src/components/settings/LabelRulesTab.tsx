import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Save, X, Plus, Beef, Sandwich, Apple, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLabelRules, type LabelRule } from "@/hooks/useLabelRules";

const DEPARTMENTS: { key: string; label: string; icon: any; subtitle: string }[] = [
  { key: "common", label: "Regole comuni", icon: Sparkles, subtitle: "Valide per tutti i reparti" },
  { key: "macelleria_fresh", label: "Macelleria — Carne Fresca", icon: Beef, subtitle: "Prodotti monocomponente" },
  { key: "macelleria_preparato", label: "Macelleria — Preparato", icon: Beef, subtitle: "Prodotti composti di carne" },
  { key: "salumeria", label: "Salumeria", icon: Sandwich, subtitle: "Salumi e prodotti lavorati" },
  { key: "ortofrutta", label: "Ortofrutta", icon: Apple, subtitle: "Frutta, verdura, generici" },
];

export default function LabelRulesTab() {
  const { rules, loading, reload } = useLabelRules();
  const [edits, setEdits] = useState<Record<string, Partial<LabelRule>>>({});

  function setEdit(id: string, patch: Partial<LabelRule>) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  }

  function value<T = any>(rule: LabelRule, field: keyof LabelRule, fallback: T): T {
    const e = edits[rule.id];
    return (e && (e as any)[field] !== undefined) ? (e as any)[field] : ((rule as any)[field] ?? fallback);
  }

  function paramValue<T = any>(rule: LabelRule, key: string, fallback: T): T {
    const params = value<Record<string, any>>(rule, "params", rule.params || {});
    const v = params?.[key];
    return (v === undefined || v === null) ? fallback : v;
  }

  function setParam(rule: LabelRule, key: string, val: any) {
    const params = value<Record<string, any>>(rule, "params", rule.params || {});
    setEdit(rule.id, { params: { ...params, [key]: val } });
  }

  async function save(rule: LabelRule) {
    const patch = edits[rule.id];
    if (!patch) return;
    const { error } = await supabase
      .from("label_rules" as any)
      .update({
        description: patch.description ?? rule.description,
        params: patch.params ?? rule.params,
      })
      .eq("id", rule.id);
    if (error) return toast.error(error.message);
    toast.success("Regola aggiornata");
    setEdits((e) => { const n = { ...e }; delete n[rule.id]; return n; });
    reload();
  }

  function cancel(rule: LabelRule) {
    setEdits((e) => { const n = { ...e }; delete n[rule.id]; return n; });
  }

  if (loading) return <div className="text-muted-foreground">Caricamento…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold">Logiche etichette</h3>
        <p className="text-sm text-muted-foreground">
          Tutte le regole applicate alle etichette, raggruppate per reparto. Le modifiche vengono applicate subito alle stampe successive.
        </p>
      </div>

      <Accordion type="multiple" defaultValue={["common"]} className="space-y-2">
        {DEPARTMENTS.map((dep) => {
          const Icon = dep.icon;
          const deptRules = rules.filter((r) => r.department_key === dep.key);
          return (
            <AccordionItem key={dep.key} value={dep.key} className="border rounded-lg bg-card">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <Icon size={18} className="text-primary shrink-0" />
                  <div>
                    <div className="font-semibold">{dep.label}</div>
                    <div className="text-xs text-muted-foreground font-normal">{dep.subtitle}</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-3">
                {deptRules.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nessuna regola configurata per questo reparto.</p>
                )}
                {deptRules.map((rule) => {
                  const dirty = !!edits[rule.id];
                  return (
                    <Card key={rule.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{rule.title}</div>
                        </div>
                        {dirty && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => cancel(rule)}>
                              <X size={14} className="mr-1" /> Annulla
                            </Button>
                            <Button size="sm" className="bg-gradient-primary" onClick={() => save(rule)}>
                              <Save size={14} className="mr-1" /> Salva
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Descrizione</Label>
                        <Textarea
                          rows={2}
                          value={value(rule, "description", "")}
                          onChange={(e) => setEdit(rule.id, { description: e.target.value })}
                        />
                      </div>

                      <ParamsEditor rule={rule} paramValue={paramValue} setParam={setParam} />
                    </Card>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function ParamsEditor({
  rule, paramValue, setParam,
}: {
  rule: LabelRule;
  paramValue: <T,>(r: LabelRule, k: string, f: T) => T;
  setParam: (r: LabelRule, k: string, v: any) => void;
}) {
  const k = `${rule.department_key}.${rule.rule_key}`;

  // Avvisi testuali
  if (k === "macelleria_fresh.notice" || k === "macelleria_preparato.notice") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">Testo avviso stampato in etichetta</Label>
        <Input
          value={paramValue(rule, "text", "")}
          onChange={(e) => setParam(rule, "text", e.target.value)}
          placeholder="Conservare da 0° e +4° — Consumare previa cottura"
        />
      </div>
    );
  }

  // Giorni shelf-life Salumeria
  if (k === "salumeria.shelf_life") {
    return (
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="space-y-1.5">
          <Label className="text-xs">Giorni — Fresco</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={paramValue(rule, "days_fresh", 5)}
            onChange={(e) => setParam(rule, "days_fresh", Math.max(1, parseInt(e.target.value || "0", 10) || 0))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Giorni — Sottovuoto</Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={paramValue(rule, "days_vacuum", 30)}
            onChange={(e) => setParam(rule, "days_vacuum", Math.max(1, parseInt(e.target.value || "0", 10) || 0))}
          />
        </div>
      </div>
    );
  }

  // Allergeni: switch + chip editor
  if (k === "common.allergens") {
    return (
      <AllergensEditor rule={rule} paramValue={paramValue} setParam={setParam} />
    );
  }

  return null;
}

function AllergensEditor({
  rule, paramValue, setParam,
}: {
  rule: LabelRule;
  paramValue: <T,>(r: LabelRule, k: string, f: T) => T;
  setParam: (r: LabelRule, k: string, v: any) => void;
}) {
  const enabled = paramValue<boolean>(rule, "enabled", true);
  const keywords = paramValue<string[]>(rule, "keywords", []);
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim().toLowerCase();
    if (!v) return;
    if (keywords.map((x) => x.toLowerCase()).includes(v)) { setDraft(""); return; }
    setParam(rule, "keywords", [...keywords, v]);
    setDraft("");
  }
  function remove(w: string) {
    setParam(rule, "keywords", keywords.filter((x) => x !== w));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Evidenziazione attiva</Label>
        <Switch checked={enabled} onCheckedChange={(v) => setParam(rule, "enabled", v)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Parole evidenziate in grassetto ({keywords.length})</Label>
        <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-muted/40 border min-h-[60px]">
          {keywords.map((w) => (
            <Badge key={w} variant="secondary" className="gap-1 pr-1">
              <span>{w}</span>
              <button onClick={() => remove(w)} className="hover:text-destructive rounded">
                <X size={12} />
              </button>
            </Badge>
          ))}
          {keywords.length === 0 && (
            <span className="text-xs text-muted-foreground">Nessuna parola configurata.</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Aggiungi una parola e premi Invio"
          />
          <Button type="button" variant="outline" onClick={add}><Plus size={14} /></Button>
        </div>
      </div>
    </div>
  );
}
