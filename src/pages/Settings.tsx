import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompanyTab from "@/components/settings/CompanyTab";
import OperatorsTab from "@/components/settings/OperatorsTab";
import AssetsTab from "@/components/settings/AssetsTab";
import IngredientsTab from "@/components/settings/IngredientsTab";
import LabelEditorTab from "@/components/settings/LabelEditorTab";
import DepartmentsTab from "@/components/settings/DepartmentsTab";
import RecurringTab from "@/components/settings/RecurringTab";
import LabelRulesTab from "@/components/settings/LabelRulesTab";
import { Building2, Users, Wrench, Leaf, FlaskConical, Tag, Building, Repeat, BookOpen } from "lucide-react";

export default function Settings() {
  return (
    <>
      <PageHeader title="Impostazioni" subtitle="Anagrafica azienda, operatori e attrezzature" />
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full max-w-4xl mb-6">
          <TabsTrigger value="company" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><Building2 size={14} className="hidden sm:inline" /> Azienda</TabsTrigger>
          <TabsTrigger value="departments" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><Building size={14} className="hidden sm:inline" /> Reparti</TabsTrigger>
          <TabsTrigger value="operators" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><Users size={14} className="hidden sm:inline" /> Operatori</TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><Wrench size={14} className="hidden sm:inline" /> Attrezz.</TabsTrigger>
          <TabsTrigger value="aromi" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><Leaf size={14} className="hidden sm:inline" /> Aromi</TabsTrigger>
          <TabsTrigger value="additivi" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><FlaskConical size={14} className="hidden sm:inline" /> Additivi</TabsTrigger>
          <TabsTrigger value="recurring" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><Repeat size={14} className="hidden sm:inline" /> Ricorrenti</TabsTrigger>
          <TabsTrigger value="etichette" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><Tag size={14} className="hidden sm:inline" /> Etichette</TabsTrigger>
          <TabsTrigger value="logiche" className="gap-1.5 text-xs sm:text-sm flex-1 min-w-[calc(33%-4px)] sm:min-w-0"><BookOpen size={14} className="hidden sm:inline" /> Logiche</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="operators"><OperatorsTab /></TabsContent>
        <TabsContent value="assets"><AssetsTab /></TabsContent>
        <TabsContent value="aromi"><IngredientsTab category="aroma" title="Aromi" subtitle="Gestisci gli aromi utilizzati nelle produzioni" /></TabsContent>
        <TabsContent value="additivi"><IngredientsTab category="additivo_allergene" title="Additivi ed Allergeni" subtitle="Gestisci additivi e allergeni utilizzati nelle produzioni" /></TabsContent>
        <TabsContent value="recurring"><RecurringTab /></TabsContent>
        <TabsContent value="etichette"><LabelEditorTab /></TabsContent>
        <TabsContent value="logiche"><LabelRulesTab /></TabsContent>
      </Tabs>
    </>
  );
}