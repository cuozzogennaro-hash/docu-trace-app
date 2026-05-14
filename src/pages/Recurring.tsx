import PageHeader from "@/components/PageHeader";
import RecurringTab from "@/components/settings/RecurringTab";

export default function RecurringPage() {
  return (
    <>
      <PageHeader title="Prodotti Ricorrenti" subtitle="Modelli riutilizzabili per velocizzare l'ingresso merci" />
      <RecurringTab />
    </>
  );
}
