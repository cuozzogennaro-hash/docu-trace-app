import { useOperatorSession } from "@/hooks/useOperatorSession";
import Dashboard from "./Dashboard";
import OperatorDashboard from "./OperatorDashboard";
import ConsulenteDashboard from "./ConsulenteDashboard";
import { useConsulente } from "@/hooks/useConsulente";

export default function Index() {
  const { operator } = useOperatorSession();
  const { isConsulente, loading } = useConsulente();
  // Solo l'account titolare vede la dashboard ricca.
  // Qualsiasi operatore (anche amministratore) vede la dashboard operatore.
  if (operator) return <OperatorDashboard />;
  if (loading) return null;
  if (isConsulente) return <ConsulenteDashboard />;
  return <Dashboard />;
}
