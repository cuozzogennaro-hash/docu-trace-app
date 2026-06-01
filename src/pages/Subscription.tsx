import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Check, Loader2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "sonner";

const FEATURES = [
  "Registrazione temperature, sanificazioni e abbattimenti",
  "Schede produzione, preparazioni e mantenimento",
  "Etichette personalizzabili con allergeni",
  "Report HACCP e pacchetti ASL firmabili",
  "Operatori con PIN e dashboard compiti",
  "Backup automatico in cloud",
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { subscription, hasAccess, isTrialing, isPastDue, isCanceled, trialDaysLeft, refetch } = useSubscription();
  const { openCheckout, loading } = usePaddleCheckout();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Pagamento ricevuto, attivazione in corso…");
      const t = setInterval(refetch, 2000);
      const stop = setTimeout(() => clearInterval(t), 20000);
      return () => { clearInterval(t); clearTimeout(stop); };
    }
  }, [searchParams, refetch]);

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
      toast.error(e?.message ?? "Errore apertura checkout");
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
      if (!url) throw new Error("URL non disponibile");
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Errore apertura portale");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      <PaymentTestModeBanner />
      <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <ShieldCheck className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">HACCP Pro</h1>
            <p className="text-sm text-muted-foreground">Abbonamento mensile</p>
          </div>
        </div>

        {subscription && (
          <Card className="p-4 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Stato abbonamento
            </div>
            {isTrialing && (
              <div className="text-sm">
                <span className="font-semibold text-primary">Prova attiva</span>
                {trialDaysLeft !== null && ` — ${trialDaysLeft} giorni rimanenti`}
              </div>
            )}
            {subscription.status === "active" && (
              <div className="text-sm">
                <span className="font-semibold text-green-700">Attivo</span>
                {subscription.cancel_at_period_end && " — si disattiverà a fine periodo"}
              </div>
            )}
            {isPastDue && (
              <div className="text-sm text-orange-700">
                <span className="font-semibold">Pagamento non andato a buon fine.</span> Aggiorna il metodo di pagamento entro 7 giorni per evitare il blocco.
              </div>
            )}
            {isCanceled && (
              <div className="text-sm text-destructive">
                <span className="font-semibold">Annullato.</span>{subscription.current_period_end && ` Accesso fino al ${new Date(subscription.current_period_end).toLocaleDateString("it-IT")}.`}
              </div>
            )}
            {subscription.current_period_end && !isCanceled && (
              <div className="text-xs text-muted-foreground">
                Prossimo rinnovo: {new Date(subscription.current_period_end).toLocaleDateString("it-IT")}
              </div>
            )}
          </Card>
        )}

        <Card className="p-6 space-y-5">
          <div>
            <div className="text-3xl font-bold">19,99 € <span className="text-base font-normal text-muted-foreground">/ mese</span></div>
            <div className="text-sm text-primary font-semibold mt-1">30 giorni di prova gratuita</div>
          </div>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check size={16} className="text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {!subscription || isCanceled ? (
            <Button onClick={startCheckout} disabled={loading} size="lg" className="w-full">
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Inizia la prova gratuita"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button onClick={openPortal} variant="outline" size="lg" className="w-full gap-2">
                Gestisci abbonamento <ExternalLink size={16} />
              </Button>
              {hasAccess && (
                <Button onClick={() => navigate("/")} variant="ghost" size="lg" className="w-full">
                  Vai all'app
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Nessun addebito durante la prova. Annulla quando vuoi.
          </p>
        </Card>

        <div className="text-xs text-muted-foreground text-center space-x-3">
          <a href="/termini" className="underline">Termini</a>
          <a href="/rimborsi" className="underline">Rimborsi</a>
          <a href="/privacy" className="underline">Privacy</a>
        </div>
      </div>
    </div>
  );
}