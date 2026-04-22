import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { hashPin } from "@/hooks/useOperators";
import { toast } from "sonner";
import { UserPlus, UserCircle2, Trash2, KeyRound, Loader2 } from "lucide-react";

type Op = { id: string; name: string; role: string | null; is_active: boolean };

export default function Operators() {
  const [list, setList] = useState<Op[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from("operators").select("id, name, role, is_active").order("name");
    setList(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return toast.error("Nome obbligatorio");
    if (pin.length < 4) return toast.error("PIN minimo 4 cifre");
    if (pin !== pin2) return toast.error("I PIN non coincidono");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      const pin_hash = await hashPin(pin, user.id);
      const { error } = await supabase.from("operators").insert({
        user_id: user.id,
        name: name.trim(),
        role: role.trim() || null,
        pin_hash,
      });
      if (error) throw error;
      toast.success("Operatore creato");
      setName(""); setRole(""); setPin(""); setPin2("");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminare l'operatore?")) return;
    await supabase.from("operators").delete().eq("id", id);
    load();
  }

  async function resetPin(op: Op) {
    const newPin = prompt(`Nuovo PIN per ${op.name} (min. 4 cifre):`);
    if (!newPin || newPin.length < 4) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const pin_hash = await hashPin(newPin, user.id);
    await supabase.from("operators").update({ pin_hash }).eq("id", op.id);
    toast.success("PIN aggiornato");
  }

  return (
    <>
      <PageHeader
        title="Operatori"
        subtitle="Gestisci chi può registrare azioni con il proprio PIN"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary gap-2"><UserPlus size={16} /> Nuovo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuovo operatore</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mario Rossi" />
                </div>
                <div className="space-y-1.5">
                  <Label>Mansione</Label>
                  <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Banco carni" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>PIN</Label>
                    <Input type="password" inputMode="numeric" maxLength={6} value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      className="text-center font-mono tracking-widest" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conferma</Label>
                    <Input type="password" inputMode="numeric" maxLength={6} value={pin2}
                      onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
                      className="text-center font-mono tracking-widest" />
                  </div>
                </div>
                <Button onClick={create} disabled={busy} className="w-full bg-gradient-primary">
                  {busy ? <Loader2 className="animate-spin" size={16} /> : "Crea"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {list.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nessun operatore. Creane uno per iniziare a tracciare chi esegue le registrazioni.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((op) => (
            <Card key={op.id} className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                <UserCircle2 className="text-primary-foreground" size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{op.name}</div>
                {op.role && <div className="text-xs text-muted-foreground truncate">{op.role}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => resetPin(op)} title="Reset PIN">
                  <KeyRound size={16} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(op.id)} title="Elimina">
                  <Trash2 size={16} className="text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}