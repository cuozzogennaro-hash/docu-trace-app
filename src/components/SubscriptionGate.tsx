import { Navigate, useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";

/**
 * Blocca l'accesso all'app se il titolare non ha un abbonamento attivo
 * (compresa prova/grace di 7gg per past_due e accesso fino a fine periodo per annullato).
 * Gli operatori che hanno fatto login con PIN passano sempre — l'accesso
 * dipende dal titolare che li ha invitati.
 */
export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { operator } = useOperatorSession();
  const { loading, hasAccess } = useSubscription();
  const location = useLocation();

  // Operatore senza sessione titolare → l'accesso è già garantito dal titolare
  if (operator && !user) return <>{children}</>;

  if (authLoading || (user && loading)) {
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