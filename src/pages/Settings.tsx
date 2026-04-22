import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanyTab from "@/components/settings/CompanyTab";
import OperatorsTab from "@/components/settings/OperatorsTab";
import AssetsTab from "@/components/settings/AssetsTab";
import { Building2, Users, Wrench } from "lucide-react";

export default function Settings() {
  return (
    <>
      <PageHeader title="Impostazioni" subtitle="Anagrafica azienda, operatori e attrezzature" />
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-xl mb-6">
          <TabsTrigger value="company" className="gap-2"><Building2 size={16} /> Azienda</TabsTrigger>
          <TabsTrigger value="operators" className="gap-2"><Users size={16} /> Operatori</TabsTrigger>
          <TabsTrigger value="assets" className="gap-2"><Wrench size={16} /> Attrezzature</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="operators"><OperatorsTab /></TabsContent>
        <TabsContent value="assets"><AssetsTab /></TabsContent>
      </Tabs>
    </>
  );
}