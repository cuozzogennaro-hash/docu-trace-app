import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Package, Factory, ChefHat, PackageX, AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  computeProductExpiry,
  daysUntil,
  expiryBadgeClass,
  expiryDotClass,
  expiryLabel,
  getExpiryStatus,
  type ExpiryStatus,
} from "@/lib/expiry";

type Row = {
  id: string;
  kind: "raw" | "product" | "preparation";
  name: string;
  lot: string | null;
  department_id: string | null;
  department_name: string | null;
  expiry: string | null;
  status: ExpiryStatus;
  days: number | null;
  detailPath: string | null;
};

type FilterKey = "expired" | "today" | "soon" | "week" | "all";

const TYPE_META = {
  raw: { icon: Package, labelKey: "Materia prima" },
  product: { icon: Factory, labelKey: "Prodotto" },
  preparation: { icon: ChefHat, labelKey: "Preparazione" },
} as const;

export default function Expiries() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("expired");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "raw" | "product" | "preparation">("all");

  async function load() {
    setLoading(true);
    try {
      const [rmRes, prRes, prepRes, deptRes, rulesRes] = await Promise.all([
        supabase
          .from("raw_materials")
          .select("id, product_name, internal_lot, expiry_date, department_id")
          .eq("is_out_of_stock", false),
        supabase
          .from("products")
          .select("id, name, internal_lot, production_date, preservation_type, department_id, is_out_of_stock")
          .eq("is_out_of_stock", false),
        supabase
          .from("preparations")
          .select("id, name, internal_expiry, is_out_of_stock")
          .eq("is_out_of_stock", false),
        supabase.from("departments").select("id, name"),
        supabase
          .from("label_rules" as any)
          .select("department_key, rule_key, params")
          .eq("department_key", "salumeria")
          .eq("rule_key", "shelf_life")
          .maybeSingle(),
      ]);

      const deptMap = new Map<string, string>(
        (deptRes.data ?? []).map((d: any) => [d.id, d.name as string]),
      );
      const shelf = ((rulesRes as any).data?.params ?? {}) as { days_fresh?: number; days_vacuum?: number };

      const out: Row[] = [];

      for (const r of (rmRes.data ?? []) as any[]) {
        const exp = r.expiry_date as string | null;
        if (!exp) continue;
        const status = getExpiryStatus(exp);
        out.push({
          id: r.id,
          kind: "raw",
          name: r.product_name,
          lot: r.internal_lot,
          department_id: r.department_id,
          department_name: r.department_id ? deptMap.get(r.department_id) ?? null : null,
          expiry: exp,
          status,
          days: daysUntil(exp),
          detailPath: `/archivio/materia-prima/${r.id}`,
        });
      }

      for (const p of (prRes.data ?? []) as any[]) {
        const exp = computeProductExpiry(p.production_date, p.preservation_type, shelf);
        if (!exp) continue;
        const status = getExpiryStatus(exp);
        out.push({
          id: p.id,
          kind: "product",
          name: p.name,
          lot: p.internal_lot,
          department_id: p.department_id,
          department_name: p.department_id ? deptMap.get(p.department_id) ?? null : null,
          expiry: exp,
          status,
          days: daysUntil(exp),
          detailPath: `/archivio/prodotto/${p.id}`,
        });
      }

      for (const pr of (prepRes.data ?? []) as any[]) {
        const exp = pr.internal_expiry ? String(pr.internal_expiry).slice(0, 10) : null;
        if (!exp) continue;
        const status = getExpiryStatus(exp);
        out.push({
          id: pr.id,
          kind: "preparation",
          name: pr.name,
          lot: null,
          department_id: null,
          department_name: null,
          expiry: exp,
          status,
          days: daysUntil(exp),
          detailPath: null,
        });
      }

      out.sort((a, b) => (a.expiry || "").localeCompare(b.expiry || ""));
      setRows(out);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { expired: 0, today: 0, soon: 0, week: 0, all: rows.length };
    for (const r of rows) {
      if (r.status === "expired") c.expired++;
      else if (r.status === "today") c.today++;
      else if (r.status === "soon") c.soon++;
      else if (r.status === "week") c.week++;
    }
    return c;
  }, [rows]);

  const departments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.department_id && r.department_name) m.set(r.department_id, r.department_name);
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "expired" && r.status !== "expired") return false;
      if (filter === "today" && r.status !== "today") return false;
      if (filter === "soon" && !(r.status === "soon" || r.status === "today" || r.status === "expired")) return false;
      if (filter === "week" && !(r.status === "week" || r.status === "soon" || r.status === "today" || r.status === "expired")) return false;
      if (typeFilter !== "all" && r.kind !== typeFilter) return false;
      if (deptFilter !== "all" && r.department_id !== deptFilter) return false;
      return true;
    });
  }, [rows, filter, typeFilter, deptFilter]);

  async function markOutOfStock(row: Row) {
    const table = row.kind === "raw" ? "raw_materials" : row.kind === "product" ? "products" : "preparations";
    const { error } = await supabase.from(table as any).update({ is_out_of_stock: true }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(t("Segnato come esaurito"));
    setRows((prev) => prev.filter((r) => !(r.id === row.id && r.kind === row.kind)));
  }

  async function createNonConformity(row: Row) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return toast.error(t("Errore"));
    const title = `${t("Prodotto scaduto")}: ${row.name}${row.lot ? " — " + row.lot : ""}`;
    const desc = `${t("Scadenza")}: ${row.expiry ? new Date(row.expiry).toLocaleDateString("it-IT") : "—"}`;
    const { error } = await supabase.from("non_conformities").insert({
      user_id: uid,
      area: "scadenza",
      severity: row.status === "expired" ? "high" : "medium",
      title,
      description: desc,
      status: "open",
    });
    if (error) return toast.error(error.message);
    toast.success(t("Non conformità creata"));
  }

  return (
    <>
      <PageHeader title={t("Scadenze")} subtitle={t("Monitoraggio scadenze di materie prime, prodotti e preparazioni")} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {([
          { key: "expired", label: t("Scaduti"), count: counts.expired, color: "border-destructive/40 bg-destructive/5", icon: AlertCircle, iconClass: "text-destructive" },
          { key: "today",   label: t("Oggi/Domani"), count: counts.today, color: "border-orange-500/40 bg-orange-500/5", icon: AlertTriangle, iconClass: "text-orange-600" },
          { key: "soon",    label: t("Entro 3 giorni"), count: counts.soon, color: "border-yellow-500/40 bg-yellow-500/5", icon: AlertTriangle, iconClass: "text-yellow-600" },
          { key: "week",    label: t("Entro 7 giorni"), count: counts.week, color: "border-emerald-500/40 bg-emerald-500/5", icon: AlertTriangle, iconClass: "text-emerald-600" },
          { key: "all",     label: t("Tutte"), count: counts.all, color: "", icon: Package, iconClass: "text-muted-foreground" },
        ] as const).map((s) => (
          <Card
            key={s.key}
            onClick={() => setFilter(s.key as FilterKey)}
            className={`p-4 cursor-pointer transition hover:shadow-elevated ${s.color} ${filter === s.key ? "ring-2 ring-primary" : ""}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={16} className={s.iconClass} />
              <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
            </div>
            <div className="font-display text-2xl font-bold">{s.count}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">{t("Tutti")}</TabsTrigger>
            <TabsTrigger value="raw">{t("Materie prime")}</TabsTrigger>
            <TabsTrigger value="product">{t("Prodotti")}</TabsTrigger>
            <TabsTrigger value="preparation">{t("Preparati")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {departments.length > 0 && (
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder={t("Reparto")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Tutti i reparti")}</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </Card>

      {loading ? (
        <div className="text-muted-foreground text-center py-10">{t("Caricamento…")}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">{t("Nessun risultato")}</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const Meta = TYPE_META[r.kind];
            return (
              <Card key={`${r.kind}-${r.id}`} className="p-3 lg:p-4 flex items-center gap-3">
                <div className={`w-2 h-12 rounded-full shrink-0 ${expiryDotClass(r.status)}`} />
                <Meta.icon size={18} className="text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{t(Meta.labelKey)}</span>
                    {r.lot && <span className="font-mono">{r.lot}</span>}
                    {r.department_name && <span>· {r.department_name}</span>}
                    {r.expiry && <span>· {t("Scadenza")}: {new Date(r.expiry).toLocaleDateString("it-IT")}</span>}
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 ${expiryBadgeClass(r.status)}`}>
                  {expiryLabel(r.status, r.days)}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => markOutOfStock(r)} className="gap-1.5">
                    <PackageX size={14} />
                    <span className="hidden sm:inline">{t("Fuori stock")}</span>
                  </Button>
                  {r.status === "expired" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => createNonConformity(r)}
                      className="gap-1.5"
                      title={t("Registra non conformità per prodotto scaduto ancora in giacenza")}
                    >
                      <ShieldAlert size={14} />
                      <span className="hidden sm:inline">{t("Non conformità")}</span>
                    </Button>
                  )}
                  {r.detailPath && (
                    <Button size="sm" variant="ghost" asChild title={t("Apri dettaglio")}>
                      <Link to={r.detailPath}><ExternalLink size={15} /></Link>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}