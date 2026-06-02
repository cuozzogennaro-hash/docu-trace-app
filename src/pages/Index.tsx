import { useOperatorSession } from "@/hooks/useOperatorSession";
import Dashboard from "./Dashboard";
import OperatorDashboard from "./OperatorDashboard";

export default function Index() {
  const { operator } = useOperatorSession();
  // Solo titolare e operatore amministratore vedono la dashboard ricca
  if (operator && !operator.is_admin) return <OperatorDashboard />;
  return <Dashboard />;
}
