import { useOperatorSession } from "@/hooks/useOperatorSession";
import Dashboard from "./Dashboard";
import OperatorDashboard from "./OperatorDashboard";

export default function Index() {
  const { operator } = useOperatorSession();
  return operator ? <OperatorDashboard /> : <Dashboard />;
}
