import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [recoveryTokenHash, setRecoveryTokenHash] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function acceptExistingRecoverySession(cleanUrl: boolean) {
      const { data } = await supabase.auth.getSession();
      if (!active) return false;

      if (data.session) {
        setHasSession(true);
        if (cleanUrl) window.history.replaceState(null, "", "/reset-password");
        return true;
      }

      return false;
    }

    async function prepareRecoverySession() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash") ?? url.searchParams.get("token") ?? hash.get("token_hash") ?? hash.get("token");
      const type = url.searchParams.get("type") ?? hash.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const hasRecoveryLink = Boolean(code || tokenHash || accessToken || type === "recovery");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        } else if (tokenHash && type === "recovery") {
          setRecoveryTokenHash(tokenHash);
          window.history.replaceState(null, "", "/reset-password");
          return;
        }

        await acceptExistingRecoverySession(hasRecoveryLink);
      } catch (err: unknown) {
        const sessionRecovered = await acceptExistingRecoverySession(hasRecoveryLink);
        if (active && !sessionRecovered) {
          setHasSession(false);
          toast.error(err instanceof Error ? err.message : t("Link di recupero non valido o scaduto"));
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!active) return;
      if (sess || event === "PASSWORD_RECOVERY") {
        setHasSession(Boolean(sess));
        setChecking(false);
        window.history.replaceState(null, "", "/reset-password");
      }
    });

    prepareRecoverySession();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSession && !recoveryTokenHash) {
      toast.error(t("Link di recupero non valido o scaduto. Richiedine uno nuovo dalla pagina di accesso."));
      return;
    }
    setBusy(true);
    try {
      if (!hasSession && recoveryTokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: recoveryTokenHash, type: "recovery" });
        if (error) throw new Error(t("Link di recupero non valido o scaduto. Richiedine uno nuovo dalla pagina di accesso."));
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("Password aggiornata. Sei dentro."));
      // Force fresh session so the new password is the only valid one
      navigate("/", { replace: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("Errore aggiornamento password"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher variant="full" />
      </div>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elevated">
            <ShieldCheck className="text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">{t("Reimposta password")}</h1>
        </div>
        <Card className="p-6 shadow-elevated">
          {checking ? (
            <p className="text-sm text-muted-foreground text-center">{t("Verifica del link in corso…")}</p>
          ) : !hasSession && !recoveryTokenHash ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">{t("Link di recupero non valido o scaduto.")}</p>
              <Button type="button" onClick={() => navigate("/auth", { replace: true })} className="w-full bg-gradient-primary">
                {t("Richiedi un nuovo link")}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("Nuova password")}</Label>
                <Input
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                {busy ? t("Attendi…") : t("Aggiorna password")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}