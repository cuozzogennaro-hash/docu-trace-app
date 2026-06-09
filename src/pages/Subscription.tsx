import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Loader2, ExternalLink, Lock, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { isInAppCheckoutBlocked } from "@/lib/platform";
import { toast } from "sonner";
import logoShield from "@/assets/logo-shield.png";

const FEATURES = [
  "Registrazione temperature, sanificazioni e abbattimenti",
  "Schede produzione, preparazioni e mantenimento",
  "Etichette personalizzabili con allergeni",
  "Report HACCP e pacchetti ASL firmabili",
  "Operatori con PIN e dashboard compiti",
  "Backup automatico in cloud",
];

type PlanId = "haccp_pro_monthly" | "haccp_pro_yearly";

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { subscription, hasAccess, isTrialing, isPastDue, isCanceled, refetch } = useSubscription();
  const { openCheckout, loading } = usePaddleCheckout();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const checkoutBlocked = isInAppCheckoutBlocked();
  const [selecting, setSelecting] = useState<PlanId | null>(null);

  const dateLocale = "it-IT";

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Pagamento ricevuto, attivazione in corso…");
      const iv = setInterval(refetch, 2000);
      const stop = setTimeout(() => clearInterval(iv), 20000);
      return () => { clearInterval(iv); clearTimeout(stop); };
    }
  }, [searchParams, refetch]);

  async function startCheckout(planId: PlanId) {
    if (!user) { navigate("/auth"); return; }
    setSelecting(planId);
    try {
      await openCheckout({
        priceId: planId,
        userId: user.id,
        customerEmail: user.email ?? undefined,
        successUrl: `${window.location.origin}/abbonamento?checkout=success`,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Errore apertura checkout");
    } finally {
      setSelecting(null);
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

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  // Utente con abbonamento attivo (active/past_due/canceled-con-grazia): mostra gestione, NON paywall
  if (hasAccess && !isTrialing) {
    return (
      <div className="min-h-screen bg-gradient-surface">
        <PaymentTestModeBanner />
        <div className="max-w-2xl mx-auto p-4 lg:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <img src={logoShield} alt="HACCP Trace" className="h-12 w-12 rounded-xl object-contain bg-white" />
            <div>
              <h1 className="font-display text-2xl font-bold">HACCP Trace</h1>
              <p className="text-sm text-muted-foreground">Il tuo abbonamento</p>
            </div>
          </div>
          <Card className="p-4 space-y-2">
            {subscription?.status === "active" && (
              <div className="text-sm">
                <span className="font-semibold text-green-700">Attivo</span>
                {subscription.cancel_at_period_end && " — si disattiverà a fine periodo"}
              </div>
            )}
            {isPastDue && (
              <div className="text-sm text-orange-700">
                <span className="font-semibold">Pagamento non andato a buon fine.</span> Aggiorna il metodo di pagamento entro 7 giorni.
              </div>
            )}
            {isCanceled && subscription?.current_period_end && (
              <div className="text-sm text-destructive">
                Accesso fino al {new Date(subscription.current_period_end).toLocaleDateString(dateLocale)}.
              </div>
            )}
            {subscription?.current_period_end && (
              <div className="text-xs text-muted-foreground">
                Prossimo rinnovo: {new Date(subscription.current_period_end).toLocaleDateString(dateLocale)}
              </div>
            )}
          </Card>
          <div className="space-y-2">
            {!checkoutBlocked && (
              <Button onClick={openPortal} variant="outline" size="lg" className="w-full gap-2">
                Gestisci abbonamento <ExternalLink size={16} />
              </Button>
            )}
            <Button onClick={() => navigate("/")} variant="ghost" size="lg" className="w-full">
              Vai all'app
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // PAYWALL — trial scaduto o nessun abbonamento
  return (
    <div className="min-h-screen bg-gradient-surface">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto p-4 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <img src={logoShield} alt="HACCP Trace" className="h-12 w-12 rounded-xl object-contain bg-white" />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold">HACCP Trace</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2">
            <LogOut size={16} /> Esci
          </Button>
        </div>

        <Card className="p-6 border-2 border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <Lock className="text-destructive shrink-0 mt-1" size={24} />
            <div>
              <h2 className="font-display text-xl font-bold text-destructive">
                Il tuo periodo di prova è terminato
              </h2>
              <p className="text-sm text-foreground/80 mt-1">
                Sblocca la piattaforma per continuare a gestire i registri della tua attività.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4 flex flex-col">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Mensile</div>
              <div className="mt-2">
                <span className="text-4xl font-bold">35€</span>
                <span className="text-base text-muted-foreground"> / mese</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Fatturazione mensile, disdetta in qualunque momento.</p>
            </div>
            <Button
              onClick={() => startCheckout("haccp_pro_monthly")}
              disabled={loading || checkoutBlocked}
              size="lg"
              variant="outline"
              className="w-full mt-auto"
            >
              {selecting === "haccp_pro_monthly" ? <Loader2 className="animate-spin" size={18} /> : "Scegli Mensile"}
            </Button>
          </Card>

          <Card className="p-6 space-y-4 flex flex-col border-2 border-primary relative">
            <div className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded">
              Risparmi 130€
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-primary font-semibold">Annuale</div>
              <div className="mt-2">
                <span className="text-4xl font-bold">290€</span>
                <span className="text-base text-muted-foreground"> / anno</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Equivale a 24,17€/mese. Un unico pagamento annuale.
              </p>
            </div>
            <Button
              onClick={() => startCheckout("haccp_pro_yearly")}
              disabled={loading || checkoutBlocked}
              size="lg"
              className="w-full mt-auto"
            >
              {selecting === "haccp_pro_yearly" ? <Loader2 className="animate-spin" size={18} /> : "Scegli Annuale"}
            </Button>
          </Card>
        </div>

        {checkoutBlocked && (
          <Card className="p-4 text-sm space-y-2 bg-muted/40">
            <p className="font-semibold">Attiva l'abbonamento dal web</p>
            <p className="text-muted-foreground">
              Per attivare l'abbonamento apri docu-trace-app.lovable.app dal browser del tuo computer o telefono.
            </p>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="font-semibold mb-3">Cosa è incluso</h3>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check size={16} className="text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
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