import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

/**
 * Hard paywall post-trial.
 * - Operatore con PIN: passa sempre (dipende dal titolare).
 * - Titolare senza abbonamento: avvia silenziosamente il trial di 14gg.
 * - Titolare con trial attivo o abbonamento `active` (o grazia past_due / canceled fino a fine periodo): naviga.
 * - Tutti gli altri stati: redirect inesorabile a /abbonamento.
 */
export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { operator } = useOperatorSession();
  const { loading, subscription, hasAccess, refetch } = useSubscription();
  const location = useLocation();
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!user || loading || subscription || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    (async () => {
      try {
        await supabase.rpc("start_local_trial" as any, { p_env: getPaddleEnvironment() });
      } finally {
        await refetch();
        setStarting(false);
      }
    })();
  }, [user, loading, subscription, refetch]);

  if (operator && !user) return <>{children}</>;

  if (authLoading || (user && (loading || starting))) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Caricamento…
      </div>
    );
  }

  if (user && !hasAccess) {
    return <Navigate to="/abbonamento" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}