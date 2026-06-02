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
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash") ?? hash.get("token_hash");
      const type = url.searchParams.get("type") ?? hash.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        } else if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (error) throw error;
        }

        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setHasSession(Boolean(data.session));
        if (data.session && (code || tokenHash || accessToken)) {
          window.history.replaceState(null, "", "/reset-password");
        }
      } catch (err: any) {
        if (active) {
          setHasSession(false);
          toast.error(err?.message ?? "Link di recupero non valido o scaduto");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    prepareRecoverySession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (sess) setHasSession(true);
      if (event === "PASSWORD_RECOVERY") setHasSession(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSession) {
      toast.error("Link di recupero non valido o scaduto. Richiedine uno nuovo dalla pagina di accesso.");
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
          {checking ? (
            <p className="text-sm text-muted-foreground text-center">Verifica del link in corso…</p>
          ) : !hasSession ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">Link di recupero non valido o scaduto.</p>
              <Button type="button" onClick={() => navigate("/auth", { replace: true })} className="w-full bg-gradient-primary">
                Richiedi un nuovo link
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
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
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                {busy ? "Attendi…" : "Aggiorna password"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}