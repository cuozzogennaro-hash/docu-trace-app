import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Loader2, FileDown, ChevronRight, Search, ChevronDown, Calendar, AlertTriangle, Thermometer } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDepartments } from "@/hooks/useDepartments";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { useActivityProfile, archiveProductsLabel } from "@/hooks/useActivityProfile";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TableKey = "raw_materials" | "products" | "temperatures" | "sanitations" | "blast_chillings";

type ColumnDef = { key: string; label: string; type?: "text" | "number" | "date" | "textarea"; readOnly?: boolean };

const CONFIGS: Record<TableKey, { label: string; columns: ColumnDef[]; relation?: string }> = {
  raw_materials: {
    label: "Materie Prime",
    columns: [
      { key: "product_name", label: "Prodotto" },
      { key: "supplier_name", label: "Fornitore" },
      { key: "internal_lot", label: "Lotto int.", readOnly: true },
      { key: "supplier_lot", label: "Lotto forn." },
      { key: "quantity", label: "Quantità" },
      { key: "document_date", label: "Data doc.", type: "date" },
      { key: "expiry_date", label: "Scadenza", type: "date" },
    ],
  },
  products: {
    label: "Prodotti",
    columns: [
      { key: "name", label: "Nome" },
      { key: "internal_lot", label: "Lotto", readOnly: true },
      { key: "production_date", label: "Produzione", type: "date" },
      { key: "notes", label: "Note", type: "textarea" },
    ],
  },
  temperatures: {
    label: "Temperature",
    relation: "assets(name, department_id)",
    columns: [
      { key: "asset_name", label: "Asset", readOnly: true },
      { key: "temperature", label: "°C", type: "number" },
      { key: "event_date", label: "Data", type: "date" },
      { key: "operator", label: "Operatore" },
      { key: "notes", label: "Note", type: "textarea" },
    ],
  },
  sanitations: {
    label: "Sanificazioni",
    relation: "assets(name, department_id)",
    columns: [
      { key: "asset_name", label: "Asset", readOnly: true },
      { key: "event_date", label: "Data", type: "date" },
      { key: "operator", label: "Operatore" },
      { key: "product_used", label: "Prodotto" },
      { key: "notes", label: "Note", type: "textarea" },
    ],
  },
  blast_chillings: {
    label: "Abbattimenti",
    columns: [
      { key: "product_name", label: "Prodotto" },
      { key: "cycle_type", label: "Ciclo" },
      { key: "temp_start", label: "T inizio °C", type: "number" },
      { key: "temp_end", label: "T fine °C", type: "number" },
      { key: "started_at", label: "Inizio", readOnly: true },
      { key: "ended_at", label: "Fine", readOnly: true },
      { key: "outcome", label: "Esito", readOnly: true },
      { key: "notes", label: "Note", type: "textarea" },
    ],
  },
};

export default function Archive() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TableKey) || "raw_materials";
  const [tab, setTab] = useState<TableKey>(
    (Object.keys(CONFIGS) as TableKey[]).includes(initialTab) ? initialTab : "raw_materials"
  );
  const { company } = useCompany();
  const { profile } = useActivityProfile();
  const productsTabLabel = archiveProductsLabel(profile);

  useEffect(() => {
    const q = searchParams.get("tab") as TableKey | null;
    if (q && q !== tab && (Object.keys(CONFIGS) as TableKey[]).includes(q)) {
      setTab(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const tabLabel = (k: TableKey) => k === "products" ? productsTabLabel : CONFIGS[k].label;

  return (
    <>
      <PageHeader title="Archivio" subtitle="Visualizza, modifica e gestisci tutti i tuoi dati HACCP" />
      <Tabs value={tab} onValueChange={(v) => { setTab(v as TableKey); setSearchParams({ tab: v }, { replace: true }); }}>
        <TabsList className="w-full grid grid-cols-2 lg:grid-cols-5 mb-4 h-auto">
          {(Object.keys(CONFIGS) as TableKey[]).map((k) => (
            <TabsTrigger key={k} value={k} className="py-2">{tabLabel(k)}</TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(CONFIGS) as TableKey[]).map((k) => (
          <TabsContent key={k} value={k}>
            <ArchiveTable tableKey={k} company={company} productsLabel={productsTabLabel} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

/* ---- helpers for monthly grouping & PDF ---- */

function groupByMonth(rows: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  for (const r of rows) {
    const d = r.event_date ? r.event_date.slice(0, 7) : "senza-data";
    (map[d] ??= []).push(r);
  }
  return map;
}

function groupByDay(rows: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  for (const r of rows) {
    const d = r.event_date ? r.event_date.slice(0, 10) : "senza-data";
    (map[d] ??= []).push(r);
  }
  return map;
}

function dayLabel(d: string): string {
  if (d === "senza-data") return "Senza data";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("it-IT", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return d; }
}

function groupByDepartment(rows: any[], departments: { id: string; name: string }[]): { key: string; name: string; items: any[] }[] {
  const byDept: Record<string, any[]> = {};
  for (const r of rows) {
    const k = r.department_id || "__none__";
    (byDept[k] ??= []).push(r);
  }
  const out: { key: string; name: string; items: any[] }[] = [];
  for (const d of departments) {
    if (byDept[d.id]) out.push({ key: d.id, name: d.name, items: byDept[d.id] });
  }
  if (byDept["__none__"]) out.push({ key: "__none__", name: "Senza reparto", items: byDept["__none__"] });
  return out;
}

function monthLabel(ym: string): string {
  if (ym === "senza-data") return "Senza data";
  const [y, m] = ym.split("-");
  const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// ---------- PDF helpers (shared layout) ----------
const PDF_PRIMARY: [number, number, number] = [30, 64, 175]; // deep indigo
const PDF_ALT: [number, number, number] = [243, 244, 246];

function cleanAddress(addr?: string | null): string[] {
  if (!addr) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  addr.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).forEach((line) => {
    const k = line.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(k)) { seen.add(k); out.push(line); }
  });
  return out;
}

function drawPdfHeader(doc: jsPDF, title: string, subtitle: string | null, company: any): number {
  const pw = doc.internal.pageSize.getWidth();
  // top accent bar
  doc.setFillColor(...PDF_PRIMARY);
  doc.rect(0, 0, pw, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 14, 9.5);
  doc.setTextColor(20, 20, 20);

  // Full company header block (right column, under top bar)
  let headerY = 20;
  if (company?.business_name) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(String(company.business_name), pw - 14, headerY, { align: "right" });
    headerY += 4.5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  const addrLines = cleanAddress(company?.address);
  for (const line of addrLines) {
    doc.text(line, pw - 14, headerY, { align: "right" });
    headerY += 4;
  }
  const contact = [company?.vat ? `P.IVA ${company.vat}` : null, company?.phone, company?.email]
    .filter(Boolean)
    .join(" • ");
  if (contact) {
    doc.text(contact, pw - 14, headerY, { align: "right" });
    headerY += 4;
  }
  doc.setTextColor(20, 20, 20);

  let y = Math.max(22, headerY + 2);
  if (subtitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(subtitle, 14, y);
    y += 5;
  }
  // separator
  doc.setDrawColor(220, 220, 220);
  doc.line(14, y, pw - 14, y);
  return y + 5;
}

function drawSignatureBlock(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const blockH = 38;
  let y = ph - blockH - 14;
  // if last table overlaps, push to new page
  const lastY = (doc as any).lastAutoTable?.finalY ?? 0;
  if (lastY > y - 6) {
    doc.addPage();
    y = ph - blockH - 14;
  }
  doc.setDrawColor(180, 180, 180);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  // Timbro
  doc.rect(14, y, 80, blockH);
  doc.text("Timbro", 18, y + 6);
  // Firma
  doc.rect(pw - 14 - 80, y, 80, blockH);
  doc.text("Firma del responsabile", pw - 14 - 76, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Data: ____ / ____ / ________", pw - 14 - 76, y + blockH - 4);
  doc.setTextColor(20, 20, 20);
}

function drawFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`Generato il ${new Date().toLocaleDateString("it-IT")}`, 14, ph - 6);
    doc.text(`Pagina ${i} di ${pageCount}`, pw - 14, ph - 6, { align: "right" });
    doc.setTextColor(20, 20, 20);
  }
}

const TABLE_BASE: any = {
  styles: { fontSize: 9, cellPadding: 2.4, lineColor: [220, 220, 220], lineWidth: 0.1, textColor: [30, 30, 30] },
  headStyles: { fillColor: PDF_PRIMARY, textColor: 255, fontStyle: "bold", halign: "left" },
  alternateRowStyles: { fillColor: PDF_ALT },
  margin: { left: 14, right: 14 },
};

function generateDailyPdf(
  date: string,
  deptGroups: { key: string; name: string; items: any[] }[],
  type: "temperatures" | "sanitations",
  company: any
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = type === "temperatures" ? "Registro Temperature" : "Registro Sanificazioni";
  let startY = drawPdfHeader(doc, title, dayLabel(date), company);

  deptGroups.forEach((dg) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF_PRIMARY);
    doc.text(dg.name, 14, startY);
    doc.setTextColor(20, 20, 20);
    autoTable(doc, {
      ...TABLE_BASE,
      startY: startY + 2.5,
      head: type === "temperatures"
        ? [["Attrezzatura", "°C", "Ora", "Note"]]
        : [["Attrezzatura", "Prodotto usato", "Ora", "Note"]],
      body: dg.items.map((r) => type === "temperatures"
        ? [
            r.asset_name ?? "—",
            r.temperature ?? "—",
            r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—",
            r.notes ?? "",
          ]
        : [
            r.asset_name ?? "—",
            r.product_used ?? "—",
            r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—",
            r.notes ?? "",
          ]
      ),
      columnStyles: type === "temperatures"
        ? { 1: { halign: "center", cellWidth: 18 }, 2: { halign: "center", cellWidth: 22 } }
        : { 2: { halign: "center", cellWidth: 22 } },
    });
    startY = (doc as any).lastAutoTable.finalY + 8;
    if (startY > 250) { doc.addPage(); startY = 20; }
  });

  drawSignatureBlock(doc);
  drawFooters(doc);
  doc.save(`${type === "temperatures" ? "temperature" : "sanificazioni"}_${date}.pdf`);
}

function generateMonthlyPdf(
  month: string, rows: any[], type: "temperatures" | "sanitations", company: any,
  departments: { id: string; name: string }[],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = type === "temperatures" ? "Registro Temperature" : "Registro Sanificazioni";
  let startY = drawPdfHeader(doc, title, monthLabel(month), company);
  const byDay = groupByDay(rows);
  const days = Object.keys(byDay).sort();
  days.forEach((day) => {
    if (startY > 250) { doc.addPage(); startY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(dayLabel(day), 14, startY);
    startY += 4;
    const deptGroups = groupByDepartment(byDay[day], departments);
    deptGroups.forEach((dg) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...PDF_PRIMARY);
      doc.text(dg.name, 16, startY);
      doc.setTextColor(20, 20, 20);
      autoTable(doc, {
        ...TABLE_BASE,
        startY: startY + 2,
        margin: { left: 16, right: 14 },
        styles: { ...TABLE_BASE.styles, fontSize: 8.5 },
        head: type === "temperatures"
          ? [["Attrezzatura", "°C", "Ora", "Note"]]
          : [["Attrezzatura", "Prodotto usato", "Ora", "Note"]],
        body: dg.items.map((r) => type === "temperatures"
          ? [
              r.asset_name ?? "—",
              r.temperature ?? "—",
              r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—",
              r.notes ?? "",
            ]
          : [
              r.asset_name ?? "—",
              r.product_used ?? "—",
              r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—",
              r.notes ?? "",
            ]
        ),
        columnStyles: type === "temperatures"
          ? { 1: { halign: "center", cellWidth: 16 }, 2: { halign: "center", cellWidth: 20 } }
          : { 2: { halign: "center", cellWidth: 20 } },
      });
      startY = (doc as any).lastAutoTable.finalY + 5;
      if (startY > 250) { doc.addPage(); startY = 20; }
    });
    startY += 3;
  });
  drawSignatureBlock(doc);
  drawFooters(doc);
  doc.save(`${type === "temperatures" ? "temperature" : "sanificazioni"}_${month}.pdf`);
}

function generateRawMaterialsMonthlyPdf(
  monthKey: string,
  monthLbl: string,
  weeks: { label: string; items: any[] }[],
  company: any,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let startY = drawPdfHeader(doc, "Registro Materie Prime", monthLbl, company);
  weeks.forEach((w) => {
    if (startY > 250) { doc.addPage(); startY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF_PRIMARY);
    doc.text(w.label, 14, startY);
    doc.setTextColor(20, 20, 20);
    autoTable(doc, {
      ...TABLE_BASE,
      startY: startY + 2.5,
      styles: { ...TABLE_BASE.styles, fontSize: 8 },
      head: [["Prodotto", "Fornitore", "Lotto int.", "Lotto forn.", "Quantità", "Data doc.", "Scadenza"]],
      body: w.items.map((r) => [
        r.product_name ?? "—",
        r.supplier_name ?? "—",
        r.internal_lot ?? "—",
        r.supplier_lot ?? "—",
        r.quantity ?? "—",
        r.document_date ?? "—",
        r.expiry_date ?? "—",
      ]),
    });
    startY = (doc as any).lastAutoTable.finalY + 8;
  });
  drawSignatureBlock(doc);
  drawFooters(doc);
  doc.save(`materie_prime_${monthKey}.pdf`);
}

function generateProductsMonthlyPdf(
  monthKey: string,
  monthLbl: string,
  weeks: { label: string; items: any[] }[],
  company: any,
  title?: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const headerTitle = title ? `Registro ${title}` : "Registro Prodotti";
  let startY = drawPdfHeader(doc, headerTitle, monthLbl, company);
  weeks.forEach((w) => {
    if (startY > 250) { doc.addPage(); startY = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...PDF_PRIMARY);
    doc.text(w.label, 14, startY);
    doc.setTextColor(20, 20, 20);
    autoTable(doc, {
      ...TABLE_BASE,
      startY: startY + 2.5,
      styles: { ...TABLE_BASE.styles, fontSize: 8.5 },
      head: [["Nome", "Lotto", "Produzione", "Note"]],
      body: w.items.map((r) => [
        r.name ?? "—",
        r.internal_lot ?? "—",
        r.production_date ?? "—",
        r.notes ?? "",
      ]),
    });
    startY = (doc as any).lastAutoTable.finalY + 8;
  });
  drawSignatureBlock(doc);
  drawFooters(doc);
  doc.save(`prodotti_${monthKey}.pdf`);
}

function ArchiveTable({ tableKey, company, productsLabel }: { tableKey: TableKey; company: any; productsLabel?: string }) {
  const cfg = CONFIGS[tableKey];
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { departments } = useDepartments();
  const [deptFilter, setDeptFilter] = useState<string>("all"); // "all" | "none" | dept id
  const { session } = useAuth();
  const { operator } = useOperatorSession();

  const supportsDept = tableKey === "raw_materials" || tableKey === "products" || tableKey === "temperatures" || tableKey === "sanitations";

  function onRowClick(r: any) {
    if (tableKey === "raw_materials") navigate(`/archivio/materia-prima/${r.id}`);
    else if (tableKey === "products") navigate(`/archivio/prodotto/${r.id}`);
  }

  const isClickable = tableKey === "raw_materials" || tableKey === "products";

  async function load() {
    setLoading(true);
    let data: any[] | null = null;
    if (!session && operator?.is_admin && operator?.pin) {
      // Operator-admin path: fetch via security-definer RPC (no Supabase session)
      const { data: res, error } = await supabase.rpc("operator_admin_list" as any, {
        p_operator_id: operator.id,
        p_pin: operator.pin,
        p_table: tableKey,
      });
      const payload = res as { ok: boolean; rows?: any[]; error?: string } | null;
      if (error || !payload?.ok) toast.error(payload?.error ?? error?.message ?? "Errore");
      data = payload?.rows ?? [];
    } else {
      const select = cfg.relation ? `*, ${cfg.relation}` : "*";
      const orderCol = (tableKey === "temperatures" || tableKey === "sanitations") ? "recorded_at" : "created_at";
      const { data: res, error } = await supabase
        .from(tableKey)
        .select(select)
        .order(orderCol, { ascending: false })
        .limit(500);
      if (error) toast.error(error.message);
      data = res ?? [];
    }
    const flattened = (data ?? []).map((r: any) => ({
      ...r,
      asset_name: r.assets?.name ?? "—",
      department_id: r.assets?.department_id ?? r.department_id ?? null,
    }));
    setRows(flattened);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tableKey, session?.user?.id, operator?.id]);

  const filteredRows = useMemo(() => {
    let base = rows;
    if (supportsDept && deptFilter !== "all") {
      if (deptFilter === "none") base = base.filter((r) => !r.department_id);
      else base = base.filter((r) => r.department_id === deptFilter);
    }
    if (!search.trim()) return base;
    const q = search.trim().toLowerCase();
    return base.filter((r) => {
      const lot = (r.internal_lot ?? "").toLowerCase();
      const supplierLot = (r.supplier_lot ?? "").toLowerCase();
      const name = (r.product_name ?? r.name ?? "").toLowerCase();
      return lot.includes(q) || supplierLot.includes(q) || name.includes(q);
    });
  }, [rows, search, deptFilter, supportsDept]);

  const isGroupable = tableKey === "temperatures" || tableKey === "sanitations";
  const grouped = useMemo(() => isGroupable ? groupByMonth(filteredRows) : {}, [filteredRows, isGroupable]);
  const sortedMonths = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  // Weekly + monthly grouping for raw materials by document_date
  const monthlyGroups = useMemo(() => {
    if (tableKey !== "raw_materials" && tableKey !== "products") return [] as { monthKey: string; monthLabel: string; items: any[]; weeks: { key: string; label: string; items: any[] }[] }[];
    const dateField = tableKey === "raw_materials" ? "document_date" : "production_date";
    const startOfWeek = (d: Date) => {
      const x = new Date(d);
      const day = (x.getDay() + 6) % 7;
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() - day);
      return x;
    };
    const weekMap: Record<string, { key: string; start: Date; items: any[] }> = {};
    for (const r of filteredRows) {
      const ref = r[dateField] || (r.created_at ? r.created_at.slice(0, 10) : null);
      let key: string;
      let start: Date;
      if (!ref) {
        key = "senza-data";
        start = new Date(0);
      } else {
        const d = new Date(ref + (ref.length === 10 ? "T00:00:00" : ""));
        start = startOfWeek(d);
        key = start.toISOString().slice(0, 10);
      }
      if (!weekMap[key]) weekMap[key] = { key, start, items: [] };
      weekMap[key].items.push(r);
    }
    const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
    const weeks = Object.values(weekMap)
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .map((g) => {
        if (g.key === "senza-data") return { key: g.key, start: g.start, monthKey: "senza-data", label: "Senza data", items: g.items };
        const end = new Date(g.start);
        end.setDate(end.getDate() + 6);
        const monthKey = `${g.start.getFullYear()}-${String(g.start.getMonth() + 1).padStart(2, "0")}`;
        return { key: g.key, start: g.start, monthKey, label: `Settimana del ${fmt(g.start)} → ${fmt(end)}`, items: g.items };
      });
    // Group weeks by month
    const monthMap: Record<string, { monthKey: string; monthLabel: string; items: any[]; weeks: typeof weeks }> = {};
    for (const w of weeks) {
      if (!monthMap[w.monthKey]) {
        monthMap[w.monthKey] = {
          monthKey: w.monthKey,
          monthLabel: w.monthKey === "senza-data" ? "Senza data" : monthLabel(w.monthKey),
          items: [],
          weeks: [],
        };
      }
      monthMap[w.monthKey].weeks.push(w);
      monthMap[w.monthKey].items.push(...w.items);
    }
    return Object.values(monthMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredRows, tableKey]);

  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if ((tableKey === "raw_materials" || tableKey === "products") && monthlyGroups.length > 0) {
      const firstMonth = monthlyGroups[0];
      setOpenMonths((prev) => (prev[firstMonth.monthKey] === undefined ? { ...prev, [firstMonth.monthKey]: true } : prev));
      if (firstMonth.weeks[0]) {
        const firstWeek = firstMonth.weeks[0];
        setOpenWeeks((prev) => (prev[firstWeek.key] === undefined ? { ...prev, [firstWeek.key]: true } : prev));
      }
    }
    if ((tableKey === "temperatures" || tableKey === "sanitations") && sortedMonths.length > 0) {
      const firstMonth = sortedMonths[0];
      setOpenMonths((prev) => (prev[firstMonth] === undefined ? { ...prev, [firstMonth]: true } : prev));
      const firstDay = (grouped[firstMonth] ?? [])
        .map((r: any) => r.event_date ? r.event_date.slice(0, 10) : "senza-data")
        .sort((a: string, b: string) => b.localeCompare(a))[0];
      if (firstDay) {
        setOpenWeeks((prev) => (prev[firstDay] === undefined ? { ...prev, [firstDay]: true } : prev));
      }
    }
  }, [monthlyGroups, sortedMonths, grouped, tableKey]);

  async function save(updated: any) {
    const payload: any = {};
    cfg.columns.forEach((c) => {
      if (c.readOnly || c.key === "asset_name") return;
      payload[c.key] = updated[c.key] === "" ? null : updated[c.key];
    });
    const { error } = await supabase.from(tableKey).update(payload).eq("id", updated.id);
    if (error) return toast.error(error.message);
    toast.success("Modifiche salvate");
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questo record?")) return;
    const { error } = await supabase.from(tableKey).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato");
    load();
  }

  async function removeMany(ids: string[], label: string) {
    if (ids.length === 0) return;
    if (!confirm(`Eliminare ${ids.length} record di "${label}"? L'azione è irreversibile.`)) return;
    const { error } = await supabase.from(tableKey).delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} record eliminati`);
    load();
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (rows.length === 0) return <Card className="p-12 text-center text-muted-foreground">Nessun record.</Card>;

  const showSearch = tableKey === "raw_materials" || tableKey === "products";

  const DeptTabs = supportsDept ? (
    <div className="mb-3 -mx-1 overflow-x-auto">
      <div className="flex gap-1.5 px-1 min-w-max">
        <button
          type="button"
          onClick={() => setDeptFilter("all")}
          className={`text-xs sm:text-sm px-3 py-1.5 rounded-full border whitespace-nowrap transition ${deptFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"}`}
        >
          Tutti
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDeptFilter(d.id)}
            className={`text-xs sm:text-sm px-3 py-1.5 rounded-full border whitespace-nowrap transition ${deptFilter === d.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border"}`}
          >
            {d.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDeptFilter("none")}
          className={`text-xs sm:text-sm px-3 py-1.5 rounded-full border whitespace-nowrap transition ${deptFilter === "none" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted border-border text-muted-foreground"}`}
        >
          Senza reparto
        </button>
      </div>
    </div>
  ) : null;

  const SearchBar = showSearch ? (
    <>
      {DeptTabs}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cerca per lotto interno, lotto fornitore o nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
    </>
  ) : null;

  /* ---- Mobile card renderer ---- */
  function MobileCard({ r }: { r: any }) {
    const fmtDate = (d?: string | null) => {
      if (!d) return null;
      try { return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "2-digit" }); } catch { return d; }
    };
    const daysUntil = (d?: string | null) => {
      if (!d) return null;
      const t = new Date(d + (d.length === 10 ? "T00:00:00" : "")).getTime();
      if (isNaN(t)) return null;
      return Math.ceil((t - Date.now()) / 86400000);
    };

    const renderActions = (
      <div className="flex items-center gap-0.5 shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
          <Pencil size={14} />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>
          <Trash2 size={14} className="text-destructive" />
        </Button>
        {isClickable && <ChevronRight size={16} className="text-muted-foreground self-center" />}
      </div>
    );

    if (tableKey === "raw_materials") {
      const expDays = daysUntil(r.expiry_date);
      const expTone =
        expDays == null ? "bg-muted text-muted-foreground"
        : expDays < 0 ? "bg-destructive/15 text-destructive"
        : expDays <= 3 ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";
      return (
        <Card className={`p-3.5 ${isClickable ? "cursor-pointer active:bg-muted/40" : ""}`} onClick={() => isClickable && onRowClick(r)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[15px] leading-tight truncate">{r.product_name ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{r.supplier_name ?? "Fornitore non indicato"}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-mono font-semibold">
                  {r.internal_lot ?? "—"}
                </span>
                {r.quantity && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium">{r.quantity}</span>
                )}
                {r.expiry_date && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${expTone}`}>
                    {expDays != null && expDays <= 3 && <AlertTriangle size={10} />}
                    Scad. {fmtDate(r.expiry_date)}
                  </span>
                )}
              </div>
            </div>
            {renderActions}
          </div>
        </Card>
      );
    }

    if (tableKey === "products") {
      return (
        <Card className={`p-3.5 ${isClickable ? "cursor-pointer active:bg-muted/40" : ""}`} onClick={() => isClickable && onRowClick(r)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[15px] leading-tight truncate">{r.name ?? "—"}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-mono font-semibold">
                  {r.internal_lot ?? "—"}
                </span>
                {r.production_date && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium">
                    <Calendar size={10} /> {fmtDate(r.production_date)}
                  </span>
                )}
              </div>
              {r.notes && <div className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{r.notes}</div>}
            </div>
            {renderActions}
          </div>
        </Card>
      );
    }

    if (tableKey === "temperatures") {
      const t = r.temperature != null ? Number(r.temperature) : null;
      return (
        <Card className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-sm font-bold tabular-nums">
                  <Thermometer size={12} /> {t != null ? `${t.toFixed(1)}°C` : "—"}
                </span>
                <span className="text-sm font-semibold truncate min-w-0">{r.asset_name ?? "—"}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1.5">
                {r.operator ?? "Operatore non indicato"}
                {r.recorded_at && <> • {new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</>}
              </div>
              {r.notes && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{r.notes}</div>}
            </div>
            {renderActions}
          </div>
        </Card>
      );
    }

    // sanitations
    return (
      <Card className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{r.asset_name ?? "—"}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {r.product_used && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-medium truncate max-w-[180px]">
                  {r.product_used}
                </span>
              )}
              {r.recorded_at && (
                <span className="text-[11px] text-muted-foreground">
                  {new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{r.operator ?? "Operatore non indicato"}</div>
          </div>
          {renderActions}
        </div>
      </Card>
    );
  }

  if (isGroupable) {
    // Build month → days → departments structure
    const monthDays: Record<string, string[]> = {};
    sortedMonths.forEach((m) => {
      const days = Array.from(new Set(grouped[m].map((r: any) => r.event_date ? r.event_date.slice(0, 10) : "senza-data"))) as string[];
      monthDays[m] = days.sort((a, b) => b.localeCompare(a));
    });
    const dayMap: Record<string, any[]> = groupByDay(filteredRows);
    return (
      <>
        {DeptTabs}
        <div className="space-y-4">
          {sortedMonths.map((month) => (
            <Collapsible
              key={month}
              open={openMonths[month] ?? false}
              onOpenChange={(o) => setOpenMonths((prev) => ({ ...prev, [month]: o }))}
            >
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/40">
                  <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition">
                    <ChevronDown size={18} className={`text-muted-foreground transition-transform shrink-0 ${openMonths[month] ? "rotate-180" : ""}`} />
                    <h3 className="font-display font-bold text-base truncate">
                      {monthLabel(month)} <span className="text-muted-foreground font-normal text-sm">({grouped[month].length})</span>
                    </h3>
                  </CollapsibleTrigger>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() => generateMonthlyPdf(month, grouped[month], tableKey as "temperatures" | "sanitations", company, departments)}
                  >
                    <FileDown size={14} /> PDF
                  </Button>
                </div>
                <CollapsibleContent>
                  <div className="p-3 space-y-2 bg-muted/10">
                    {monthDays[month].map((day) => {
                      const dayItems = dayMap[day] ?? [];
                      const deptGroups = groupByDepartment(dayItems, departments);
                      return (
                        <Collapsible
                          key={day}
                          open={openWeeks[day] ?? false}
                          onOpenChange={(o) => setOpenWeeks((prev) => ({ ...prev, [day]: o }))}
                        >
                          <Card className="overflow-hidden">
                            <div className="w-full flex items-center justify-between gap-2 px-3 py-2 border-b bg-card">
                              <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-muted/40 transition rounded -mx-1 px-1">
                                <ChevronDown size={14} className={`text-muted-foreground transition-transform shrink-0 ${openWeeks[day] ? "rotate-180" : ""}`} />
                                <span className="font-medium text-sm capitalize">
                                  {dayLabel(day)} <span className="text-muted-foreground font-normal">({dayItems.length})</span>
                                </span>
                              </CollapsibleTrigger>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5 shrink-0 h-7"
                                onClick={() => generateDailyPdf(day, deptGroups, tableKey as "temperatures" | "sanitations", company)}
                              >
                                <FileDown size={13} /> PDF
                              </Button>
                            </div>
                            <CollapsibleContent>
                              <div className="divide-y">
                                {deptGroups.map((dg) => (
                                  <div key={dg.key} className="p-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                      {dg.name} <span className="font-normal normal-case">({dg.items.length})</span>
                                    </div>
                                    {/* Desktop */}
                                    <div className="overflow-x-auto hidden md:block">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            {cfg.columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                                            <TableHead className="text-right">Azioni</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {dg.items.map((r: any) => (
                                            <TableRow key={r.id}>
                                              {cfg.columns.map((c) => (
                                                <TableCell key={c.key} className="text-sm">{r[c.key] ?? "—"}</TableCell>
                                              ))}
                                              <TableCell className="text-right whitespace-nowrap">
                                                <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                                                  <Pencil size={14} />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                                                  <Trash2 size={14} className="text-destructive" />
                                                </Button>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                    {/* Mobile */}
                                    <div className="md:hidden space-y-2">
                                      {dg.items.map((r: any) => (
                                        <MobileCard key={r.id} r={r} />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                {deptGroups.length === 0 && (
                                  <div className="p-4 text-center text-sm text-muted-foreground">Nessun dato.</div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
          {sortedMonths.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">Nessun risultato.</Card>
          )}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Modifica record</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {cfg.columns.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label>{c.label}</Label>
                    {c.type === "textarea" ? (
                      <Textarea
                        value={editing[c.key] ?? ""}
                        disabled={c.readOnly}
                        onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })}
                      />
                    ) : (
                      <Input
                        type={c.type ?? "text"}
                        value={editing[c.key] ?? ""}
                        disabled={c.readOnly}
                        onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <Button onClick={() => save(editing)} className="w-full bg-gradient-primary">Salva modifiche</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (tableKey === "raw_materials" || tableKey === "products") {
    return (
      <>
        {SearchBar}
        <div className="space-y-3">
          {monthlyGroups.map((mg) => (
            <Collapsible
              key={mg.monthKey}
              open={openMonths[mg.monthKey] ?? false}
              onOpenChange={(o) => setOpenMonths((prev) => ({ ...prev, [mg.monthKey]: o }))}
            >
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-muted/40">
                  <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition">
                    <ChevronDown size={18} className={`text-muted-foreground transition-transform shrink-0 ${openMonths[mg.monthKey] ? "rotate-180" : ""}`} />
                    <h3 className="font-display font-bold text-base truncate">{mg.monthLabel} <span className="text-muted-foreground font-normal text-sm">({mg.items.length})</span></h3>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() =>
                        tableKey === "raw_materials"
                          ? generateRawMaterialsMonthlyPdf(mg.monthKey, mg.monthLabel, mg.weeks, company)
                          : generateProductsMonthlyPdf(mg.monthKey, mg.monthLabel, mg.weeks, company, productsLabel)
                      }
                    >
                      <FileDown size={14} /> PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => removeMany(mg.items.map((r: any) => r.id), mg.monthLabel)}
                    >
                      <Trash2 size={14} /> Elimina
                    </Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="p-3 space-y-2 bg-muted/10">
                    {mg.weeks.map((g) => (
                      <Collapsible
                        key={g.key}
                        open={openWeeks[g.key] ?? false}
                        onOpenChange={(o) => setOpenWeeks((prev) => ({ ...prev, [g.key]: o }))}
                      >
                        <Card className="overflow-hidden">
                          <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 border-b bg-card hover:bg-muted/40 transition text-left">
                            <span className="font-medium text-sm">{g.label} <span className="text-muted-foreground font-normal">({g.items.length})</span></span>
                            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${openWeeks[g.key] ? "rotate-180" : ""}`} />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="overflow-x-auto hidden md:block">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    {cfg.columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                                    <TableHead className="text-right">Azioni</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {g.items.map((r: any) => (
                                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onRowClick(r)}>
                                      {cfg.columns.map((c) => (
                                        <TableCell key={c.key} className="text-sm">{r[c.key] ?? "—"}</TableCell>
                                      ))}
                                      <TableCell className="text-right whitespace-nowrap">
                                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
                                          <Pencil size={14} />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>
                                          <Trash2 size={14} className="text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                            <div className="md:hidden divide-y">
                              {g.items.map((r: any) => (
                                <div key={r.id} className="p-3"><MobileCard r={r} /></div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
          {monthlyGroups.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">Nessun risultato.</Card>
          )}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Modifica record</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {cfg.columns.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label>{c.label}</Label>
                    {c.type === "textarea" ? (
                      <Textarea value={editing[c.key] ?? ""} disabled={c.readOnly} onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })} />
                    ) : (
                      <Input type={c.type ?? "text"} value={editing[c.key] ?? ""} disabled={c.readOnly} onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })} />
                    )}
                  </div>
                ))}
                <Button onClick={() => save(editing)} className="w-full bg-gradient-primary">Salva modifiche</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {SearchBar}
      {/* Desktop table */}
      <Card className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {cfg.columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={r.id} className={isClickable ? "cursor-pointer hover:bg-muted/40" : ""} onClick={() => isClickable && onRowClick(r)}>
                  {cfg.columns.map((c) => (
                    <TableCell key={c.key} className="text-sm">
                      {r[c.key] ?? "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filteredRows.map((r) => (
          <MobileCard key={r.id} r={r} />
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifica record</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {cfg.columns.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <Label>{c.label}</Label>
                  {c.type === "textarea" ? (
                    <Textarea
                      value={editing[c.key] ?? ""}
                      disabled={c.readOnly}
                      onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })}
                    />
                  ) : (
                    <Input
                      type={c.type ?? "text"}
                      value={editing[c.key] ?? ""}
                      disabled={c.readOnly}
                      onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <Button onClick={() => save(editing)} className="w-full bg-gradient-primary">Salva modifiche</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}