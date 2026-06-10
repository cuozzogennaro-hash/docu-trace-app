import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Building, Plus, Pencil, Trash2, Lock, Upload, X } from "lucide-react";
import { useDepartments } from "@/hooks/useDepartments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROTECTED_NAMES = ["macelleria", "salumeria", "salumenria", "ortofrutta"];
const isProtected = (name: string) => PROTECTED_NAMES.includes(name.trim().toLowerCase());

export default function DepartmentsTab() {
  const { departments, hiddenIds, setHidden, reload } = useDepartments();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; scale_department_code?: number | null; image_url?: string | null } | null>(null);
  const [name, setName] = useState("");
  const [scaleCode, setScaleCode] = useState<string>("");
  const [shelfLifeDays, setShelfLifeDays] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setEditing(null);
    setName("");
    setScaleCode("");
    setShelfLifeDays("");
    setImageUrl("");
    setOpen(true);
  }
  function openEdit(d: { id: string; name: string; scale_department_code?: number | null; default_shelf_life_days?: number | null; image_url?: string | null }) {
    setEditing(d);
    setName(d.name);
    setScaleCode(d.scale_department_code != null ? String(d.scale_department_code) : "");
    setShelfLifeDays(d.default_shelf_life_days != null ? String(d.default_shelf_life_days) : "");
    setImageUrl(d.image_url ?? "");
    setOpen(true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return toast.error("Sessione non valida"); }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/dept-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("logos").upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
    setImageUrl(pub.publicUrl);
    setUploading(false);
    toast.success("Immagine caricata");
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Nome obbligatorio");
    if (!editing && isProtected(trimmed)) {
      return toast.error("Questo reparto è già predefinito");
    }
    const scaleCodeNum = scaleCode.trim() === "" ? null : parseInt(scaleCode.trim(), 10);
    if (scaleCodeNum !== null && (!Number.isFinite(scaleCodeNum) || scaleCodeNum < 0)) {
      return toast.error("Codice reparto bilancia non valido");
    }
    const shelfDaysNum = shelfLifeDays.trim() === "" ? null : parseInt(shelfLifeDays.trim(), 10);
    if (shelfDaysNum !== null && (!Number.isFinite(shelfDaysNum) || shelfDaysNum < 1)) {
      return toast.error("Giorni di scadenza non validi");
    }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return toast.error("Sessione non valida"); }
    const res = editing
      ? await supabase.from("departments").update({ name: trimmed, scale_department_code: scaleCodeNum, default_shelf_life_days: shelfDaysNum, image_url: imageUrl || null } as any).eq("id", editing.id)
      : await supabase.from("departments").insert({
          user_id: user.id,
          name: trimmed,
          sort_order: (departments[departments.length - 1]?.sort_order ?? 0) + 1,
          scale_department_code: scaleCodeNum,
          default_shelf_life_days: shelfDaysNum,
          image_url: imageUrl || null,
        } as any);
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Reparto aggiornato" : "Reparto aggiunto");
    setOpen(false);
    reload();
  }

  async function remove(d: { id: string; name: string }) {
    if (isProtected(d.name)) return;
    if (!confirm(`Eliminare il reparto "${d.name}"?`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Reparto eliminato");
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Reparti</h3>
          <p className="text-sm text-muted-foreground">
            Macelleria, Salumeria e Ortofrutta sono predefiniti e non modificabili. Puoi aggiungere reparti personalizzati.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-gradient-primary gap-2 shrink-0">
              <Plus size={16} /> Nuovo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica reparto" : "Nuovo reparto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="es. Pescheria"
                  disabled={!!editing && isProtected(editing.name)}
                />
                {!!editing && isProtected(editing.name) && (
                  <p className="text-[11px] text-muted-foreground">
                    Reparto predefinito: il nome non è modificabile, ma puoi cambiare immagine e altre opzioni.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Codice Reparto Bilancia</Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={scaleCode}
                  onChange={(e) => setScaleCode(e.target.value)}
                  placeholder="es. 1 (Macelleria), 2 (Salumeria)"
                />
                <p className="text-xs text-muted-foreground">
                  Codice numerico interno usato dalle bilance di reparto per identificare questo reparto. Lascia vuoto se non utilizzato.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Scadenza di default (giorni)</Label>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={shelfLifeDays}
                  onChange={(e) => setShelfLifeDays(e.target.value)}
                  placeholder="es. 3"
                />
                <p className="text-xs text-muted-foreground">
                  In fase di creazione lavorazione la data di scadenza sarà pre-compilata come <em>data produzione + giorni</em>. Sempre modificabile a mano. Lascia vuoto per non pre-compilare nulla.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Immagine reparto (per pagina Lavorazioni)</Label>
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Building size={22} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2 justify-start">
                      <Upload size={14} /> {uploading ? "Caricamento…" : (imageUrl ? "Sostituisci immagine" : "Carica immagine")}
                    </Button>
                    {imageUrl && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")} className="gap-2 justify-start text-destructive">
                        <X size={14} /> Rimuovi
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mostrata come card nella schermata di selezione reparto in <em>Lavorazioni / Ricette</em>.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={save} disabled={busy} className="bg-gradient-primary">Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {departments.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nessun reparto disponibile.</Card>
      ) : (
        <div className="space-y-2">
          {departments.map((d) => {
            const visible = !hiddenIds.includes(d.id);
            const locked = isProtected(d.name);
            return (
              <Card key={d.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {(d as any).image_url ? (
                    <img src={(d as any).image_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-gradient-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Building size={16} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-1.5">
                      {d.name}
                      {locked && <Lock size={12} className="text-muted-foreground" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {locked ? "Predefinito · " : ""}{visible ? "Visibile in Ingresso merci" : "Nascosto in Ingresso merci"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={visible} onCheckedChange={(v) => setHidden(d.id, !v)} />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(d)} title={locked ? "Modifica immagine e opzioni" : "Modifica reparto"}>
                    <Pencil size={15} />
                  </Button>
                  {!locked && (
                    <Button size="icon" variant="ghost" onClick={() => remove(d)}>
                      <Trash2 size={15} className="text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}