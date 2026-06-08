import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Store as StoreIcon, Plus, Pencil, Trash2, Copy, KeyRound, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Store = {
  id: string;
  name: string;
  address: string | null;
  scale_integration_active: boolean;
  scale_api_key: string;
};

export default function StoresTab() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [scaleActive, setScaleActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setStores((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setName("");
    setAddress("");
    setScaleActive(false);
    setOpen(true);
  }

  function openEdit(s: Store) {
    setEditing(s);
    setName(s.name);
    setAddress(s.address ?? "");
    setScaleActive(s.scale_integration_active);
    setOpen(true);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Nome obbligatorio");
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return toast.error("Sessione non valida"); }
    const payload = {
      name: trimmed,
      address: address.trim() || null,
      scale_integration_active: scaleActive,
    };
    const res = editing
      ? await supabase.from("stores").update(payload).eq("id", editing.id)
      : await supabase.from("stores").insert({ ...payload, user_id: user.id } as any);
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Punto vendita aggiornato" : "Punto vendita aggiunto");
    setOpen(false);
    load();
  }

  async function remove(s: Store) {
    if (!confirm(`Eliminare "${s.name}"? Le righe di coda bilance collegate verranno rimosse.`)) return;
    const { error } = await supabase.from("stores").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Punto vendita eliminato");
    load();
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Chiave copiata negli appunti");
    } catch {
      toast.error("Copia non riuscita");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Punti Vendita</h3>
          <p className="text-sm text-muted-foreground">
            Gestisci uno o più punti vendita. Attiva <strong>Integrazione bilance</strong> solo se utilizzi le bilance industriali di reparto (es. Bizerba, Avery Berkel).
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
              <DialogTitle>{editing ? "Modifica punto vendita" : "Nuovo punto vendita"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Sede Principale" />
              </div>
              <div className="space-y-2">
                <Label>Indirizzo</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via, città" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="flex items-center gap-2 font-medium"><Scale size={16} /> Integrazione bilance di reparto</div>
                  <div className="text-xs text-muted-foreground">Sblocca la sincronizzazione PLU / lotti / ingredienti con le bilance.</div>
                </div>
                <Switch checked={scaleActive} onCheckedChange={setScaleActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={save} disabled={busy} className="bg-gradient-primary">Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">Caricamento…</Card>
      ) : stores.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nessun punto vendita.</Card>
      ) : (
        <div className="space-y-2">
          {stores.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-lg bg-gradient-primary/10 flex items-center justify-center text-primary shrink-0">
                    <StoreIcon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.address || "—"}
                    </div>
                    <div className="mt-1 text-[11px]">
                      {s.scale_integration_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <Scale size={10} /> Bilance attive
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Bilance disattivate
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil size={15} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(s)}>
                    <Trash2 size={15} className="text-destructive" />
                  </Button>
                </div>
              </div>

              {s.scale_integration_active && (
                <div className="mt-3 rounded-md bg-muted/50 border border-border p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
                    <KeyRound size={12} /> Chiave API per applicativo bilance
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] font-mono break-all bg-card px-2 py-1.5 rounded border border-border">{s.scale_api_key}</code>
                    <Button size="sm" variant="outline" onClick={() => copyKey(s.scale_api_key)} className="gap-1">
                      <Copy size={13} /> Copia
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Inserisci questa chiave nell'applicativo installato sul PC collegato alle bilance per autorizzare la sincronizzazione.
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}