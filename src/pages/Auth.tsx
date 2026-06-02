import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, Building2, UserCircle2, AtSign, Loader2 } from "lucide-react";
import { getPaddleEnvironment } from "@/lib/paddle";

export default function AuthPage() {
  const { session, loading } = useAuth();
  const { operator, signIn: signInOperator } = useOperatorSession();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // operator login fields
  const [handle, setHandle] = useState("");
  const [opPin, setOpPin] = useState("");
  const [opBusy, setOpBusy] = useState(false);

  if (!loading && (session || operator)) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (data.session) {
          await supabase.rpc("start_local_trial" as any, { p_env: getPaddleEnvironment() });
          toast.success("Benvenuto! Hai 30 giorni di prova gratuita.");
        } else {
          toast.success("Account creato. Controlla la tua email per confermare.");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(
          "Email inviata. Attenzione: il link nell'email può apparire poco visibile — cliccalo comunque.",
          { duration: 9000 },
        );
        setMode("signin");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) {
        await supabase.rpc("start_local_trial" as any, { p_env: getPaddleEnvironment() });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Errore accesso Google");
      setBusy(false);
    }
  }

  async function operatorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim() || opPin.length < 4) {
      return toast.error("Inserisci nome utente e PIN");
    }
    setOpBusy(true);
    try {
      const { data, error } = await supabase.rpc("operator_login", {
        p_handle: handle.trim().toLowerCase(),
        p_pin: opPin,
      });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string; operator_id?: string; name?: string; role?: string | null; is_admin?: boolean };
      if (!res.ok) {
        if (res.error === "not_found") toast.error("Nome utente non trovato");
        else toast.error("PIN errato");
        setOpPin("");
        return;
      }
      signInOperator({ id: res.operator_id!, name: res.name!, role: res.role ?? null, pin: opPin, is_admin: res.is_admin ?? false });
      toast.success(`Benvenuto ${res.name}`);
    } catch (err: any) {
      toast.error(err.message ?? "Errore");
    } finally {
      setOpBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elevated">
            <ShieldCheck className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">HACCP Pro</h1>
            <p className="text-xs text-muted-foreground">Autocontrollo alimentare smart</p>
          </div>
        </div>
        <Card className="p-6 shadow-elevated">
          <Tabs defaultValue="operator" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="operator" className="gap-2"><UserCircle2 size={16} /> Operatore</TabsTrigger>
              <TabsTrigger value="admin" className="gap-2"><Building2 size={16} /> Titolare</TabsTrigger>
            </TabsList>

            <TabsContent value="operator">
              <form onSubmit={operatorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><AtSign size={14} /> Nome utente</Label>
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase())}
                    placeholder="mario-bistrotdamario"
                    className="font-mono"
                    autoCapitalize="none"
                    autoComplete="username"
                    maxLength={60}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Te lo fornisce il titolare della tua attività.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={opPin}
                    onChange={(e) => setOpPin(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="••••"
                    required
                  />
                </div>
                <Button type="submit" disabled={opBusy} className="w-full bg-gradient-primary">
                  {opBusy ? <Loader2 className="animate-spin" size={16} /> : "Accedi come operatore"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin">
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {mode === "forgot" && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                    <p className="font-medium text-foreground">Come funziona il recupero</p>
                    <p className="text-muted-foreground">
                      Riceverai un'email da Lovable. Il pulsante "Reset Password" potrebbe apparire
                      poco visibile (testo chiaro su sfondo chiaro): cliccalo lo stesso o clicca
                      sullo spazio vuoto sotto il messaggio per aprire la pagina di reimpostazione.
                    </p>
                  </div>
                )}
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                )}
                <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                  {busy ? "Attendi…" : mode === "signin" ? "Accedi" : mode === "signup" ? "Crea account (30gg gratis)" : "Invia link reset"}
                </Button>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">oppure</span></div>
                </div>
                <Button type="button" variant="outline" onClick={googleSignIn} disabled={busy} className="w-full">
                  Continua con Google
                </Button>
                <div className="flex justify-between text-xs pt-2">
                  {mode !== "signin" ? (
                    <button type="button" onClick={() => setMode("signin")} className="text-muted-foreground hover:text-foreground underline">
                      Hai già un account? Accedi
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => setMode("signup")} className="text-muted-foreground hover:text-foreground underline">
                        Registrati (30gg gratis)
                      </button>
                      <button type="button" onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-foreground underline">
                        Password dimenticata?
                      </button>
                    </>
                  )}
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
        <div className="mt-6 text-center text-xs text-muted-foreground space-x-3">
          <a href="/abbonamento" className="underline hover:text-foreground">Prezzi</a>
          <a href="/termini" className="underline hover:text-foreground">Termini</a>
          <a href="/rimborsi" className="underline hover:text-foreground">Rimborsi</a>
          <a href="/privacy" className="underline hover:text-foreground">Privacy</a>
        </div>
      </div>
    </div>
  );
}