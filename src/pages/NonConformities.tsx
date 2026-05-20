import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import OperatorPinDialog from "@/components/OperatorPinDialog";
import { useNonConformities, type NonConformity } from "@/hooks/useNonConformities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const AREA_LABEL: Record<string, string> = {
  temperatura: "Temperatura",
  pulizia: "Pulizia/Sanificazione",
  fornitore: "Fornitore/Merce",
  attrezzatura: "Attrezzatura",
  prodotto: "Prodotto",
  altro: "Altro",
};

export default function NonConformities() {
  const { rows, reload } = useNonConformities();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [title, setTitle] = useState("");
  const [area, setArea] = useState<NonConformity["area"]>("altro");
  const [severity, setSeverity] = useState<NonConformity["severity"]>("low");
  const [description, setDescription] = useState("");
  const [corrective, setCorrective] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);

  const filtered = useMemo(() => filter === "open" ? rows.filter((r) => r.status === "open") : rows, [rows, filter]);

  function handleSave() {
    if (!title) return toast.error("Indica un titolo");
    setPinOpen(true);
  }

  async function saveWith(op: { id: string; name: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sessione scaduta");

    if (resolveId) {
      const { error } = await supabase.from("non_conformities" as any)
        .update({ status: "resolved", resolved_at: new Date().toISOString(), corrective_action: corrective || null })
        .eq("id", resolveId);
      if (error) return toast.error(error.message);
      toast.success(`Risolto da ${op.name}`);
      setResolveId(null); setCorrective("");
      reload();
      return;
    }

    const { error } = await supabase.from("non_conformities" as any).insert({
      user_id: user.id,
      operator_id: op.id,
      title, area, severity,
      description: description || null,
      corrective_action: corrective || null,
      status: "open",
    });
    if (error) return toast.error(error.message);
    toast.success(`Non conformità registrata (${op.name})`);
    setTitle(""); setDescription(""); setCorrective(""); setArea("altro"); setSeverity("low");
    reload();
  }

  function startResolve(id: string) {
    setResolveId(id); setCorrective("");
    setPinOpen(true);
  }

  return (
    <>
      <PageHeader title="Non conformità" subtitle="Registro NC con azione correttiva (HACCP)" />

      <Card className="p-5 shadow-soft mb-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Titolo</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Frigo carne a 8°C, salsa scaduta" />
          </div>
          <div className="space-y-2">
            <Label>Area</Label>
            <Select value={area} onValueChange={(v: any) => setArea(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(AREA_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Gravità</Label>
            <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Bassa</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Descrizione</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Cosa è successo, dove, quando" />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Azione correttiva prevista</Label>
            <Textarea rows={2} value={corrective} onChange={(e) => setCorrective(e.target.value)} placeholder="Es. scartato lotto, riparato, contattato fornitore" />
          </div>
        </div>
        <Button onClick={handleSave} className="mt-5 w-full lg:w-auto bg-gradient-primary gap-2">
          <ShieldCheck size={16} /> Identifica e registra
        </Button>
      </Card>

      <OperatorPinDialog
        open={pinOpen}
        onOpenChange={(v) => { setPinOpen(v); if (!v) setResolveId(null); }}
        onConfirm={saveWith}
        title={resolveId ? "Chi risolve la NC?" : "Chi rileva la NC?"}
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-3">
        <TabsList>
          <TabsTrigger value="open">Aperte</TabsTrigger>
          <TabsTrigger value="all">Tutte</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {r.status === "open" ? <AlertCircle size={14} className="text-destructive" /> : <CheckCircle2 size={14} className="text-primary" />}
                  <div className="font-semibold truncate">{r.title}</div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.detected_at).toLocaleString("it-IT")}</div>
                {r.description && <p className="text-sm mt-1.5">{r.description}</p>}
                {r.corrective_action && <p className="text-xs mt-1 text-muted-foreground"><b>Azione:</b> {r.corrective_action}</p>}
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  <Badge variant="outline">{AREA_LABEL[r.area]}</Badge>
                  <Badge variant={r.severity === "high" ? "destructive" : r.severity === "medium" ? "default" : "secondary"}>
                    {r.severity === "high" ? "Alta" : r.severity === "medium" ? "Media" : "Bassa"}
                  </Badge>
                  <Badge variant={r.status === "open" ? "destructive" : "outline"}>
                    {r.status === "open" ? "Aperta" : `Risolta ${r.resolved_at ? new Date(r.resolved_at).toLocaleDateString("it-IT") : ""}`}
                  </Badge>
                </div>
              </div>
              {r.status === "open" && (
                <Button size="sm" variant="outline" onClick={() => startResolve(r.id)} className="shrink-0">
                  Risolvi
                </Button>
              )}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Nessuna non conformità.</p>}
      </div>
    </>
  );
}