import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOperators, type Operator } from "@/hooks/useOperators";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function OperatorSwitcherDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { operators, loading } = useOperators();
  const { signIn } = useOperatorSession();
  const [selected, setSelected] = useState<Operator | null>(null);
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setPin("");
    }
  }, [open]);

  async function verify() {
    if (!selected || pin.length < 4) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.rpc("operator_verify_pin", {
        p_operator_id: selected.id,
        p_pin: pin,
      });
      const res = data as { ok: boolean; name?: string; role?: string | null; is_admin?: boolean } | null;
      if (error || !res?.ok) {
        toast.error("PIN errato");
        setPin("");
        return;
      }
      signIn({ id: selected.id, name: res.name ?? selected.name, role: res.role ?? selected.role, pin, is_admin: res.is_admin ?? false });
      toast.success(`Benvenuto ${res.name ?? selected.name}`);
      onOpenChange(false);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary" size={20} /> Cambio operatore
          </DialogTitle>
          <DialogDescription>Seleziona il tuo nome e inserisci il PIN.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
        ) : operators.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Nessun operatore configurato.</p>
            <Link to="/impostazioni" onClick={() => onOpenChange(false)}>
              <Button variant="outline">Crea operatore</Button>
            </Link>
          </div>
        ) : !selected ? (
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {operators.map((op) => (
              <button
                key={op.id}
                onClick={() => setSelected(op)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition"
              >
                <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                  <UserCircle2 className="text-primary-foreground" size={28} />
                </div>
                <div className="font-medium text-sm text-center leading-tight">{op.name}</div>
                {op.role && <div className="text-[10px] text-muted-foreground">{op.role}</div>}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <UserCircle2 className="text-primary-foreground" size={22} />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{selected.name}</div>
                {selected.role && <div className="text-xs text-muted-foreground">{selected.role}</div>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setPin(""); }}>Cambia</Button>
            </div>
            <div className="space-y-2">
              <Label>PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && verify()}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="••••"
              />
            </div>
            <Button onClick={verify} disabled={verifying || pin.length < 4} className="w-full bg-gradient-primary">
              {verifying ? <Loader2 className="animate-spin" size={16} /> : "Accedi"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}