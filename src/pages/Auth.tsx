import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { Building2, UserCircle2, AtSign, Loader2 } from "lucide-react";
import { getPaddleEnvironment } from "@/lib/paddle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import logoShield from "@/assets/logo-shield.png";

export default function AuthPage() {
  const { session, loading } = useAuth();
  const { operator, signIn: signInOperator } = useOperatorSession();
  const { t } = useTranslation();
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
          toast.success(t("Benvenuto!"));
        } else {
          toast.success(t("Account creato. Controlla la tua email per confermare."));
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(
          t("Email inviata. Attenzione: il link nell'email può apparire poco visibile — cliccalo comunque."),
          { duration: 9000 },
        );
        setMode("signin");
      }
    } catch (err: any) {
      toast.error(err.message ?? t("Errore"));
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
      toast.error(err.message ?? t("Errore accesso Google"));
      setBusy(false);
    }
  }

  async function appleSignIn() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) {
        await supabase.rpc("start_local_trial" as any, { p_env: getPaddleEnvironment() });
      }
    } catch (err: any) {
      toast.error(err.message ?? t("Errore accesso Apple"));
      setBusy(false);
    }
  }

  async function operatorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim() || opPin.length < 4) {
      return toast.error(t("Inserisci nome utente e PIN"));
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
        if (res.error === "not_found") toast.error(t("Nome utente non trovato"));
        else toast.error(t("PIN errato"));
        setOpPin("");
        return;
      }
      signInOperator({ id: res.operator_id!, name: res.name!, role: res.role ?? null, pin: opPin, is_admin: res.is_admin ?? false });
      toast.success(`${t("Benvenuto")} ${res.name}`);
    } catch (err: any) {
      toast.error(err.message ?? t("Errore"));
    } finally {
      setOpBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher variant="full" />
      </div>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={logoShield} alt="HACCP Trace" className="h-14 w-14 rounded-2xl object-contain bg-white shadow-elevated" />
          <div>
            <h1 className="font-display text-2xl font-bold">HACCP Trace — Gestione Autocontrollo Alimentare</h1>
            <p className="text-xs text-muted-foreground">{t("Autocontrollo alimentare smart")}</p>
          </div>
        </div>
        <Card className="p-6 shadow-elevated">
          <Tabs defaultValue="operator" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="operator" className="gap-2"><UserCircle2 size={16} /> {t("Operatore")}</TabsTrigger>
              <TabsTrigger value="admin" className="gap-2"><Building2 size={16} /> {t("Titolare")}</TabsTrigger>
            </TabsList>

            <TabsContent value="operator">
              <form onSubmit={operatorSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><AtSign size={14} /> {t("Nome utente")}</Label>
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
                    {t("Te lo fornisce il titolare della tua attività.")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("PIN")}</Label>
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
                  {opBusy ? <Loader2 className="animate-spin" size={16} /> : t("Accedi come operatore")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin">
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("Email")}</Label>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {mode === "forgot" && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                    <p className="font-medium text-foreground">{t("Come funziona il recupero")}</p>
                    <p className="text-muted-foreground">
                      {t("Riceverai un'email da Lovable. Il pulsante \"Reset Password\" potrebbe apparire poco visibile (testo chiaro su sfondo chiaro): cliccalo lo stesso o clicca sullo spazio vuoto sotto il messaggio per aprire la pagina di reimpostazione.")}
                    </p>
                  </div>
                )}
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label>{t("Password")}</Label>
                    <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                )}
                <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                  {busy ? t("Attendi…") : mode === "signin" ? t("Accedi") : mode === "signup" ? t("Crea account") : t("Invia link reset")}
                </Button>
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">{t("oppure")}</span></div>
                </div>
                <Button type="button" variant="outline" onClick={googleSignIn} disabled={busy} className="w-full">
                  {t("Continua con Google")}
                </Button>
                <Button type="button" variant="outline" onClick={appleSignIn} disabled={busy} className="w-full">
                  {t("Continua con Apple")}
                </Button>
                <div className="flex justify-between text-xs pt-2">
                  {mode !== "signin" ? (
                    <button type="button" onClick={() => setMode("signin")} className="text-muted-foreground hover:text-foreground underline">
                      {t("Hai già un account? Accedi")}
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => setMode("signup")} className="text-muted-foreground hover:text-foreground underline">
                        {t("Registrati")}
                      </button>
                      <button type="button" onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-foreground underline">
                        {t("Password dimenticata?")}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
        <div className="mt-6 text-center text-xs text-muted-foreground space-x-3">
          <a href="/termini" className="underline hover:text-foreground">{t("Termini")}</a>
          <a href="/rimborsi" className="underline hover:text-foreground">{t("Rimborsi")}</a>
          <a href="/privacy" className="underline hover:text-foreground">{t("Privacy")}</a>
        </div>
      </div>
    </div>
  );
}