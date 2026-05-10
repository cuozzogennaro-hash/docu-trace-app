import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Building } from "lucide-react";
import { toast } from "sonner";
import { useDepartments, type Department } from "@/hooks/useDepartments";

export default function DepartmentsTab() {
  const { departments, reload } = useDepartments();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");

  function startNew() {
    setEditing(null);
    setName("");
    setOpen(true);
  }
  function startEdit(d: Department) {
    setEditing(d);
    setName(d.name);
    setOpen(true);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Nome obbligatorio");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const res = editing
      ? await supabase.from("departments").update({ name: trimmed }).eq("id", editing.id)
      : await supabase.from("departments").insert({ user_id: user.id, name: trimmed, sort_order: departments.length });
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Reparto aggiornato" : "Reparto creato");
    setOpen(false);
    reload();
  }

  async function remove(d: Department) {
    if (!confirm(`Eliminare il reparto "${d.name}"? Le materie prime e i prodotti collegati resteranno ma senza reparto.`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Reparto eliminato");
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Reparti</h3>
          <p className="text-sm text-muted-foreground">Organizza materie prime e prodotti per reparto</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startNew} className="bg-gradient-primary gap-2"><Plus size={16} /> Nuovo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica reparto" : "Nuovo reparto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Pasticceria" autoFocus />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={save} className="bg-gradient-primary">Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {departments.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nessun reparto. Aggiungi il primo per iniziare.</Card>
      ) : (
        <div className="space-y-2">
          {departments.map((d) => (
            <Card key={d.id} className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-lg bg-gradient-primary/10 flex items-center justify-center text-primary">
                  <Building size={16} />
                </div>
                <div className="font-semibold truncate">{d.name}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => startEdit(d)}><Pencil size={16} /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(d)}><Trash2 size={16} className="text-destructive" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}