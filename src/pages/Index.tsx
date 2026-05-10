import { useOperatorSession } from "@/hooks/useOperatorSession";
import Dashboard from "./Dashboard";
import OperatorDashboard from "./OperatorDashboard";

export default function Index() {
  const { operator } = useOperatorSession();
  if (operator) return <OperatorDashboard />;
  return <Dashboard />;
}
