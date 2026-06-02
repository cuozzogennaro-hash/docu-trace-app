import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Check, Loader2, ExternalLink, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { isInAppCheckoutBlocked } from "@/lib/platform";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const FEATURE_KEYS = [
  "Registrazione temperature, sanificazioni e abbattimenti",
  "Schede produzione, preparazioni e mantenimento",
  "Etichette personalizzabili con allergeni",
  "Report HACCP e pacchetti ASL firmabili",
  "Operatori con PIN e dashboard compiti",
  "Backup automatico in cloud",
];

export default function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("en") ? "en-GB" : "it-IT";
  const { user } = useAuth();
  const { subscription, hasAccess, isTrialing, isPastDue, isCanceled, trialDaysLeft, refetch } = useSubscription();
  const { openCheckout, loading } = usePaddleCheckout();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const checkoutBlocked = isInAppCheckoutBlocked();

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success(t("Pagamento ricevuto, attivazione in corso…"));
      const iv = setInterval(refetch, 2000);
      const stop = setTimeout(() => clearInterval(iv), 20000);
      return () => { clearInterval(iv); clearTimeout(stop); };
    }
  }, [searchParams, refetch, t]);

  async function startCheckout() {
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      await openCheckout({
        priceId: "haccp_pro_monthly",
        userId: user.id,
        customerEmail: user.email ?? undefined,
        successUrl: `${window.location.origin}/abbonamento?checkout=success`,
      });
    } catch (e: any) {
      toast.error(e?.message ?? t("Errore apertura checkout"));
    }
  }

  async function openPortal() {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: getPaddleEnvironment() },
      });
      if (error) throw error;
      const url = data?.subscriptionUrls?.[0]?.cancelSubscription
        ?? data?.subscriptionUrls?.[0]?.updateSubscriptionPaymentMethod
        ?? data?.overviewUrl;
      if (!url) throw new Error(t("URL non disponibile"));
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? t("Errore apertura portale"));
    }
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <PaymentTestModeBanner />
      <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-6">
        <button
          onClick={() => navigate("/auth")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Indietro")}
        </button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <ShieldCheck className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">HACCP Pro</h1>
            <p className="text-sm text-muted-foreground">{t("Abbonamento mensile")}</p>
          </div>
        </div>

        {subscription && (
          <Card className="p-4 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {t("Stato abbonamento")}
            </div>
            {isTrialing && (
              <div className="text-sm">
                <span className="font-semibold text-primary">{t("Prova attiva")}</span>
                {trialDaysLeft !== null && ` ${t("— {{n}} giorni rimanenti", { n: trialDaysLeft })}`}
              </div>
            )}
            {subscription.status === "active" && (
              <div className="text-sm">
                <span className="font-semibold text-green-700">{t("Attivo")}</span>
                {subscription.cancel_at_period_end && ` — ${t("si disattiverà a fine periodo")}`}
              </div>
            )}
            {isPastDue && (
              <div className="text-sm text-orange-700">
                <span className="font-semibold">{t("Pagamento non andato a buon fine.")}</span> {t("Aggiorna il metodo di pagamento entro 7 giorni per evitare il blocco.")}
              </div>
            )}
            {isCanceled && (
              <div className="text-sm text-destructive">
                <span className="font-semibold">{t("Annullato.")}</span>{subscription.current_period_end && ` ${t("Accesso fino al {{date}}.", { date: new Date(subscription.current_period_end).toLocaleDateString(dateLocale) })}`}
              </div>
            )}
            {subscription.current_period_end && !isCanceled && (
              <div className="text-xs text-muted-foreground">
                {t("Prossimo rinnovo: {{date}}", { date: new Date(subscription.current_period_end).toLocaleDateString(dateLocale) })}
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 space-y-5">
          <div>
            <div className="text-3xl font-bold">19,99 € <span className="text-base font-normal text-muted-foreground">{t("/ mese")}</span></div>
            <div className="text-sm text-primary font-semibold mt-1">{t("30 giorni di prova gratuita")}</div>
          </div>
          <ul className="space-y-2">
            {FEATURE_KEYS.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check size={16} className="text-primary mt-0.5 shrink-0" />
                <span>{t(f)}</span>
              </li>
            ))}
          </ul>

          {checkoutBlocked && !hasAccess ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-2">
              <p className="font-semibold">{t("Attiva l'abbonamento dal web")}</p>
              <p className="text-muted-foreground">
                {t("Per attivare o gestire l'abbonamento apri docu-trace-app.lovable.app dal browser del tuo computer o telefono. Dopo l'attivazione potrai accedere a tutte le funzioni qui nell'app.")}
              </p>
            </div>
          ) : !subscription || isCanceled ? (
            <Button onClick={startCheckout} disabled={loading} size="lg" className="w-full">
              {loading ? <Loader2 className="animate-spin" size={18} /> : isCanceled ? t("Riattiva abbonamento") : t("Inizia la prova gratuita")}
            </Button>
          ) : !hasAccess ? (
            <Button onClick={startCheckout} disabled={loading} size="lg" className="w-full">
              {loading ? <Loader2 className="animate-spin" size={18} /> : t("Attiva abbonamento")}
            </Button>
          ) : (
            <div className="space-y-2">
              {!checkoutBlocked && (
                <Button onClick={openPortal} variant="outline" size="lg" className="w-full gap-2">
                  {t("Gestisci abbonamento")} <ExternalLink size={16} />
                </Button>
              )}
              {hasAccess && (
                <Button onClick={() => navigate("/")} variant="ghost" size="lg" className="w-full">
                  {t("Vai all'app")}
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            {t("Nessun addebito durante la prova. Annulla quando vuoi.")}
          </p>
        </Card>

        <div className="text-xs text-muted-foreground text-center space-x-3">
          <a href="/termini" className="underline">{t("Termini")}</a>
          <a href="/rimborsi" className="underline">{t("Rimborsi")}</a>
          <a href="/privacy" className="underline">{t("Privacy")}</a>
        </div>
      </div>
    </div>
  );
}