import { useOperatorSession } from "@/hooks/useOperatorSession";
import Dashboard from "./Dashboard";
import OperatorDashboard from "./OperatorDashboard";

export default function Index() {
  const { operator } = useOperatorSession();
  // Solo l'account titolare vede la dashboard ricca.
  // Qualsiasi operatore (anche amministratore) vede la dashboard operatore.
  if (operator) return <OperatorDashboard />;
  return <Dashboard />;
}
