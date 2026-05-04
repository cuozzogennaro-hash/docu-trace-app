import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanyTab from "@/components/settings/CompanyTab";
import OperatorsTab from "@/components/settings/OperatorsTab";
import AssetsTab from "@/components/settings/AssetsTab";
import IngredientsTab from "@/components/settings/IngredientsTab";
import { Building2, Users, Wrench, Leaf, FlaskConical } from "lucide-react";

export default function Settings() {
  return (
    <>
      <PageHeader title="Impostazioni" subtitle="Anagrafica azienda, operatori e attrezzature" />
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl mb-6">
          <TabsTrigger value="company" className="gap-2"><Building2 size={16} /> Azienda</TabsTrigger>
          <TabsTrigger value="operators" className="gap-2"><Users size={16} /> Operatori</TabsTrigger>
          <TabsTrigger value="assets" className="gap-2"><Wrench size={16} /> Attrezzature</TabsTrigger>
          <TabsTrigger value="aromi" className="gap-2"><Leaf size={16} /> Aromi</TabsTrigger>
          <TabsTrigger value="additivi" className="gap-2"><FlaskConical size={16} /> Additivi</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="operators"><OperatorsTab /></TabsContent>
        <TabsContent value="assets"><AssetsTab /></TabsContent>
        <TabsContent value="aromi"><IngredientsTab category="aroma" title="Aromi" subtitle="Gestisci gli aromi utilizzati nelle produzioni" /></TabsContent>
        <TabsContent value="additivi"><IngredientsTab category="additivo_allergene" title="Additivi ed Allergeni" subtitle="Gestisci additivi e allergeni utilizzati nelle produzioni" /></TabsContent>
      </Tabs>
    </>
  );
}