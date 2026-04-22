import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import CompanyHeader from "@/components/CompanyHeader";
import { Sparkles, Thermometer, Package, Factory, AlertTriangle, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [stats, setStats] = useState({
    sanitToday: 0,
    tempToday: 0,
    rawMaterials: 0,
    products: 0,
    outOfStock: 0,
    missingToday: false,
  });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [s, t, rm, pr, oos] = await Promise.all([
        supabase.from("sanitations").select("id", { count: "exact", head: true }).eq("event_date", today),
        supabase.from("temperatures").select("id", { count: "exact", head: true }).eq("event_date", today),
        supabase.from("raw_materials").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("raw_materials").select("id", { count: "exact", head: true }).eq("is_out_of_stock", true),
      ]);
      setStats({
        sanitToday: s.count ?? 0,
        tempToday: t.count ?? 0,
        rawMaterials: rm.count ?? 0,
        products: pr.count ?? 0,
        outOfStock: oos.count ?? 0,
        missingToday: (s.count ?? 0) === 0 || (t.count ?? 0) === 0,
      });
    })();
  }, []);

  const tiles = [
    { to: "/sanificazione", icon: Sparkles, label: "Sanificazioni oggi", value: stats.sanitToday, color: "bg-gradient-primary" },
    { to: "/temperature", icon: Thermometer, label: "Rilevazioni oggi", value: stats.tempToday, color: "bg-gradient-primary" },
    { to: "/ingresso", icon: Package, label: "Materie prime", value: stats.rawMaterials, color: "bg-gradient-accent" },
    { to: "/produzione", icon: Factory, label: "Prodotti registrati", value: stats.products, color: "bg-gradient-accent" },
  ];

  return (
    <>
      <CompanyHeader />
      <PageHeader title="Dashboard" subtitle="Panoramica del tuo autocontrollo HACCP" />

      {stats.missingToday && (
        <Card className="p-4 mb-6 border-warning/40 bg-warning/5 flex items-start gap-3">
          <AlertTriangle className="text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-foreground">Registri incompleti oggi</div>
            <p className="text-muted-foreground">Ricordati di compilare sanificazioni e rilevazioni temperature.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className="p-4 lg:p-5 hover:shadow-elevated transition cursor-pointer h-full">
              <div className={`h-11 w-11 rounded-xl ${t.color} flex items-center justify-center mb-3`}>
                <t.icon className="text-primary-foreground" size={20} />
              </div>
              <div className="font-display text-3xl font-bold">{t.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      {stats.outOfStock > 0 && (
        <Link to="/acquisti">
          <Card className="mt-6 p-4 flex items-center gap-4 hover:shadow-elevated transition cursor-pointer">
            <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center">
              <ShoppingCart className="text-accent-foreground" size={20} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Lista acquisti</div>
              <div className="text-sm text-muted-foreground">{stats.outOfStock} articoli esauriti da riordinare</div>
            </div>
          </Card>
        </Link>
      )}
    </>
  );
}