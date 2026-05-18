import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllergens, type Allergen } from "@/hooks/useAllergens";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type EditState = {
  id?: string;
  name: string;
  keywordsText: string;
  notes: string;
};

const EMPTY: EditState = { name: "", keywordsText: "", notes: "" };

export default function AllergensTab() {
  const { session } = useAuth();
  const { allergens, loading, reload } = useAllergens();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEdit(EMPTY);
    setOpen(true);
  }
  function openEdit(a: Allergen) {
    setEdit({
      id: a.id,
      name: a.name,
      keywordsText: (a.keywords || []).join(", "),
      notes: a.notes || "",
    });
    setOpen(true);
  }

  async function save() {
    if (!session?.user) return;
    const name = edit.name.trim();
    if (!name) return toast.error("Inserisci il nome dell'allergene");
    const keywords = Array.from(new Set(
      edit.keywordsText.split(/[,\n;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
    ));
    setSaving(true);
    const payload: any = {
      user_id: session.user.id,
      name,
      keywords,
      notes: edit.notes.trim() || null,
    };
    let error;
    if (edit.id) {
      ({ error } = await supabase.from("allergens" as any).update(payload).eq("id", edit.id));
    } else {
      ({ error } = await supabase.from("allergens" as any).insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(edit.id ? "Allergene aggiornato" : "Allergene aggiunto");
    setOpen(false);
    reload();
  }

  async function remove(a: Allergen) {
    if (!confirm(`Eliminare "${a.name}"?`)) return;
    const { error } = await supabase.from("allergens" as any).delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Allergene eliminato");
    reload();
  }

  if (loading) return <div className="text-muted-foreground">Caricamento…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <AlertTriangle size={18} className="text-primary" /> Allergeni
          </h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Lista di riferimento usata solo per evidenziare in <b>grassetto</b> le parole allergeniche dentro la lista ingredienti delle etichette.
            Non serve associarli a un lotto o a un fornitore. Per ogni allergene puoi indicare più parole/derivati.
          </p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary">
          <Plus size={14} className="mr-1" /> Aggiungi allergene
        </Button>
      </div>

      {allergens.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Nessun allergene configurato.
        </Card>
      ) : (
        <div className="grid gap-2">
          {allergens.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{a.name}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(a.keywords || []).length === 0 && (
                      <span className="text-xs text-muted-foreground">Nessuna parola</span>
                    )}
                    {(a.keywords || []).map((k) => (
                      <Badge key={k} variant="secondary" className="font-mono text-[10px]">{k}</Badge>
                    ))}
                  </div>
                  {a.notes && (
                    <div className="mt-2 text-xs text-muted-foreground">{a.notes}</div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(a)} className="text-destructive hover:text-destructive">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit.id ? "Modifica allergene" : "Nuovo allergene"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="Es. Glutine"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Parole / derivati (separati da virgola)</Label>
              <Textarea
                rows={3}
                value={edit.keywordsText}
                onChange={(e) => setEdit({ ...edit, keywordsText: e.target.value })}
                placeholder="grano, frumento, segale, orzo, farro"
              />
              <p className="text-[11px] text-muted-foreground">
                Tutte queste parole, quando compaiono nella lista ingredienti, vengono stampate in grassetto.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note (facoltative)</Label>
              <Input
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              <X size={14} className="mr-1" /> Annulla
            </Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-primary">
              {saving ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}