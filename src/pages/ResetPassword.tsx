import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically on mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (sess) setHasSession(true);
      if (event === "PASSWORD_RECOVERY") setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSession) {
      toast.error("Link di recupero scaduto o non valido. Richiedine uno nuovo dalla pagina di accesso.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password aggiornata. Sei dentro.");
      // Force fresh session so the new password is the only valid one
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Errore aggiornamento password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elevated">
            <ShieldCheck className="text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">Reimposta password</h1>
        </div>
        <Card className="p-6 shadow-elevated">
          <form onSubmit={submit} className="space-y-4">
              {!hasSession && (
                <p className="text-xs text-destructive">
                  Sessione di recupero non rilevata. Apri questa pagina cliccando il link nell'email,
                  altrimenti la nuova password non verrà salvata.
                </p>
              )}
              <div className="space-y-2">
                <Label>Nuova password</Label>
                <Input
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy || !hasSession} className="w-full bg-gradient-primary">
                {busy ? "Attendi…" : "Aggiorna password"}
              </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}