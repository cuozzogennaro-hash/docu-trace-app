import { useOperatorSession } from "@/hooks/useOperatorSession";
import Dashboard from "./Dashboard";
import OperatorDashboard from "./OperatorDashboard";
import { useConsulente } from "@/hooks/useConsulente";

function ConsulenteDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard Consulente</h1>
      <p className="text-muted-foreground mt-2">
        Segnaposto temporaneo — l'interfaccia del consulente verrà implementata nelle fasi successive.
      </p>
    </div>
  );
}

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
