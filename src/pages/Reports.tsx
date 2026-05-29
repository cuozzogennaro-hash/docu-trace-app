import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Thermometer, Sparkles, Factory, Package, Loader2, FileDown, Snowflake, Flame, Droplet, ChefHat, ClipboardCheck, PenLine, X } from "lucide-react";
import { toast } from "sonner";

type ReportKey =
  | "temperatures"
  | "sanitations"
  | "production"
  | "incoming"
  | "blast_chillings"
  | "holding"
  | "oil_checks"
  | "preparations"
  | "kitchen"
  | "full";

type AslPeriodKind = "month" | "quarter" | "year" | "custom";

const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

function monthRange(ym: string) {
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), label: `${MONTHS_IT[m - 1]} ${y}` };
}

function fmtDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function aslPeriodRange(kind: AslPeriodKind, customStart?: string, customEnd?: string) {
  const today = new Date();
  if (kind === "month") {
    const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 1));
    return { start: fmtDay(start), end: fmtDay(end), label: `${MONTHS_IT[today.getMonth()]} ${today.getFullYear()}` };
  }
  if (kind === "quarter") {
    const qIdx = Math.floor(today.getMonth() / 3);
    const start = new Date(Date.UTC(today.getFullYear(), qIdx * 3, 1));
    const end = new Date(Date.UTC(today.getFullYear(), qIdx * 3 + 3, 1));
    return { start: fmtDay(start), end: fmtDay(end), label: `${MONTHS_IT[qIdx * 3]} – ${MONTHS_IT[qIdx * 3 + 2]} ${today.getFullYear()}` };
  }
  if (kind === "year") {
    const start = new Date(Date.UTC(today.getFullYear(), 0, 1));
    const end = new Date(Date.UTC(today.getFullYear() + 1, 0, 1));
    return { start: fmtDay(start), end: fmtDay(end), label: `Anno ${today.getFullYear()}` };
  }
  // custom
  const s = customStart || fmtDay(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
  const eRaw = customEnd || fmtDay(today);
  // end is exclusive in our queries -> add one day to include selected end day
  const eDate = new Date(eRaw + "T00:00:00Z");
  eDate.setUTCDate(eDate.getUTCDate() + 1);
  return { start: s, end: fmtDay(eDate), label: `${formatDate(s)} – ${formatDate(eRaw)}` };
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("it-IT");
}

export default function Reports() {
  const { user } = useAuth();
  const { company } = useCompany();
  const today = new Date();
  const defaultYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [ym, setYm] = useState(defaultYm);
  const [busy, setBusy] = useState<ReportKey | null>(null);

  // ASL package state
  const [aslPeriodKind, setAslPeriodKind] = useState<AslPeriodKind>("month");
  const [aslCustomStart, setAslCustomStart] = useState<string>(fmtDay(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1))));
  const [aslCustomEnd, setAslCustomEnd] = useState<string>(fmtDay(today));
  const [aslIncludeAnagrafiche, setAslIncludeAnagrafiche] = useState(true);
  const [aslIncludeSummary, setAslIncludeSummary] = useState(true);
  const [aslIncludeNc, setAslIncludeNc] = useState(true);
  const [aslIncludePhotos, setAslIncludePhotos] = useState(false);
  const [aslSignatureData, setAslSignatureData] = useState<string | null>(null);
  const [aslBusy, setAslBusy] = useState(false);

  async function logoDataUrl(): Promise<{ data: string; w: number; h: number } | null> {
    if (!company.logo_url) return null;
    try {
      const res = await fetch(company.logo_url);
      const blob = await res.blob();
      const data: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = data;
      });
      return { data, w: img.naturalWidth, h: img.naturalHeight };
    } catch {
      return null;
    }
  }

  function drawHeader(doc: jsPDF, title: string, periodLabel: string, logo: Awaited<ReturnType<typeof logoDataUrl>>) {
    const pageW = doc.internal.pageSize.getWidth();
    let x = 14;
    if (logo) {
      const maxH = 18;
      const ratio = logo.w / logo.h;
      const h = maxH;
      const w = h * ratio;
      try { doc.addImage(logo.data, "PNG", 14, 10, w, h); } catch {}
      x = 14 + w + 6;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(company.business_name ?? "Azienda", x, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const subParts = [company.vat && `P.IVA ${company.vat}`, company.address, company.city].filter(Boolean);
    doc.text(subParts.join(" • "), x, 21);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, pageW / 2, 36, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Periodo: ${periodLabel}`, pageW / 2, 42, { align: "center" });
    doc.setDrawColor(180);
    doc.line(14, 46, pageW - 14, 46);
  }

  function drawFooter(doc: jsPDF) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Generato il ${new Date().toLocaleString("it-IT")}`, 14, pageH - 8);
      doc.text(`Pagina ${i} di ${total}`, pageW - 14, pageH - 8, { align: "right" });
      doc.text("Documento HACCP — autocontrollo", pageW / 2, pageH - 8, { align: "center" });
      doc.setTextColor(0);
    }
  }

  function drawSignatureBlock(doc: jsPDF) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const y = pageH - 28;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Responsabile autocontrollo", 14, y);
    doc.setFont("helvetica", "normal");
    doc.line(14, y + 10, 90, y + 10);
    doc.setFont("helvetica", "bold");
    doc.text("Data e firma", pageW - 14 - 76, y, { align: "left" });
    doc.setFont("helvetica", "normal");
    doc.line(pageW - 14 - 76, y + 10, pageW - 14, y + 10);
  }

  async function fetchTemperatures(start: string, end: string) {
    const { data } = await supabase
      .from("temperatures")
      .select("event_date, recorded_at, temperature, operator, notes, assets:asset_id(name, target_temp_min, target_temp_max)")
      .eq("user_id", user!.id)
      .gte("event_date", start)
      .lt("event_date", end)
      .order("event_date", { ascending: true })
      .order("recorded_at", { ascending: true });
    return (data ?? []) as any[];
  }
  async function fetchSanitations(start: string, end: string) {
    const { data } = await supabase
      .from("sanitations")
      .select("event_date, recorded_at, operator, product_used, notes, assets:asset_id(name)")
      .eq("user_id", user!.id)
      .gte("event_date", start)
      .lt("event_date", end)
      .order("event_date", { ascending: true });
    return (data ?? []) as any[];
  }
  async function fetchProduction(start: string, end: string) {
    const { data } = await supabase
      .from("products")
      .select("name, production_date, internal_lot, notes, preservation_type, department_id")
      .eq("user_id", user!.id)
      .gte("production_date", start)
      .lt("production_date", end)
      .order("production_date", { ascending: true });
    return await attachDepartments(data ?? []);
  }
  async function fetchIncoming(start: string, end: string) {
    const { data } = await supabase
      .from("raw_materials")
      .select("created_at, document_date, document_number, supplier_name, product_name, internal_lot, supplier_lot, quantity, expiry_date, category, department_id")
      .eq("user_id", user!.id)
      .gte("created_at", `${start}T00:00:00`)
      .lt("created_at", `${end}T00:00:00`)
      .order("created_at", { ascending: true });
    return await attachDepartments(data ?? []);
  }

  async function attachDepartments(rows: any[]) {
    if (!rows.length) return rows;
    const ids = Array.from(new Set(rows.map((r) => r.department_id).filter(Boolean)));
    if (!ids.length) return rows;
    const { data: deps } = await supabase.from("departments").select("id, name").in("id", ids);
    const map = new Map((deps ?? []).map((d: any) => [d.id, d.name]));
    return rows.map((r) => ({ ...r, departments: r.department_id ? { name: map.get(r.department_id) ?? "—" } : null }));
  }

  async function fetchBlastChillings(start: string, end: string) {
    const { data } = await (supabase as any)
      .from("blast_chillings")
      .select("started_at, ended_at, product_name, cycle_type, temp_start, temp_end, outcome, notes, assets:asset_id(name)")
      .eq("user_id", user!.id)
      .gte("started_at", `${start}T00:00:00`)
      .lt("started_at", `${end}T00:00:00`)
      .order("started_at", { ascending: true });
    return (data ?? []) as any[];
  }
  async function fetchHolding(start: string, end: string) {
    const { data } = await (supabase as any)
      .from("holding_records")
      .select("recorded_at, product_name, mode, temperature, outcome, notes, assets:asset_id(name)")
      .eq("user_id", user!.id)
      .gte("recorded_at", `${start}T00:00:00`)
      .lt("recorded_at", `${end}T00:00:00`)
      .order("recorded_at", { ascending: true });
    return (data ?? []) as any[];
  }
  async function fetchOilChecks(start: string, end: string) {
    const { data } = await (supabase as any)
      .from("oil_checks")
      .select("checked_at, fryer_name, action, polar_compounds, outcome, notes, assets:asset_id(name)")
      .eq("user_id", user!.id)
      .gte("checked_at", `${start}T00:00:00`)
      .lt("checked_at", `${end}T00:00:00`)
      .order("checked_at", { ascending: true });
    return (data ?? []) as any[];
  }
  async function fetchPreparations(start: string, end: string) {
    const { data } = await (supabase as any)
      .from("preparations")
      .select("prepared_at, name, storage_type, internal_expiry, ingredients_text, notes")
      .eq("user_id", user!.id)
      .gte("prepared_at", `${start}T00:00:00`)
      .lt("prepared_at", `${end}T00:00:00`)
      .order("prepared_at", { ascending: true });
    return (data ?? []) as any[];
  }

  function tempTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 52,
      head: [["Data", "Attrezzatura", "Range (°C)", "Temp. (°C)", "Esito", "Operatore", "Note"]],
      body: rows.map((r) => {
        const min = r.assets?.target_temp_min;
        const max = r.assets?.target_temp_max;
        const t = Number(r.temperature);
        let esito = "—";
        if (min != null && max != null) esito = t >= Number(min) && t <= Number(max) ? "OK" : "FUORI RANGE";
        return [
          formatDate(r.event_date),
          r.assets?.name ?? "—",
          min != null && max != null ? `${min} / ${max}` : "—",
          isNaN(t) ? "—" : t.toFixed(1),
          esito,
          r.operator ?? "—",
          r.notes ?? "",
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4 && data.cell.raw === "FUORI RANGE") {
          data.cell.styles.textColor = [200, 30, 30];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  function sanitTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 52,
      head: [["Data", "Attrezzatura/Area", "Prodotto usato", "Operatore", "Note"]],
      body: rows.map((r) => [
        formatDate(r.event_date),
        r.assets?.name ?? "—",
        r.product_used ?? "—",
        r.operator ?? "—",
        r.notes ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
    });
  }

  function productionTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 52,
      head: [["Data prod.", "Prodotto", "Reparto", "Lotto interno", "Conservazione", "Note"]],
      body: rows.map((r) => [
        formatDate(r.production_date),
        r.name ?? "—",
        r.departments?.name ?? "—",
        r.internal_lot ?? "—",
        r.preservation_type === "fresh" ? "Fresco" :
        r.preservation_type === "vacuum" ? "Sottovuoto" :
        r.preservation_type === "vaschetta" ? "In vaschetta" :
        r.preservation_type === "refrigerato" ? "Refrigerato" :
        r.preservation_type === "abbattuto" ? "Abbattuto" :
        r.preservation_type === "surgelato" ? "Surgelato" :
        r.preservation_type ?? "—",
        r.notes ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
    });
  }

  function incomingTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 52,
      head: [["Data doc.", "Fornitore", "DDT n.", "Prodotto", "Reparto", "Lotto fornitore", "Lotto interno", "Q.tà", "Scadenza"]],
      body: rows.map((r) => [
        formatDate(r.document_date ?? r.created_at),
        r.supplier_name ?? "—",
        r.document_number ?? "—",
        r.product_name ?? "—",
        r.departments?.name ?? "—",
        r.supplier_lot ?? "—",
        r.internal_lot ?? "—",
        r.quantity ?? "—",
        formatDate(r.expiry_date),
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
    });
  }

  function blastTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 52,
      head: [["Inizio", "Fine", "Prodotto", "Ciclo", "Abbattitore", "T. inizio", "T. fine", "Esito", "Note"]],
      body: rows.map((r) => [
        new Date(r.started_at).toLocaleString("it-IT"),
        r.ended_at ? new Date(r.ended_at).toLocaleString("it-IT") : "Da completare",
        r.product_name ?? "—",
        r.cycle_type === "positive" ? "+3°C" : "-18°C",
        r.assets?.name ?? "—",
        r.temp_start != null ? `${r.temp_start}°C` : "—",
        r.temp_end != null ? `${r.temp_end}°C` : "—",
        r.outcome === "ok" ? "Conforme" : "Anomalia",
        r.notes ?? "",
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 7 && data.cell.raw === "Anomalia") {
          data.cell.styles.textColor = [200, 30, 30];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  function holdingTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 52,
      head: [["Data/ora", "Prodotto", "Modalità", "Attrezzatura", "Temp.", "Esito", "Note"]],
      body: rows.map((r) => [
        new Date(r.recorded_at).toLocaleString("it-IT"),
        r.product_name ?? "—",
        r.mode === "hot" ? "Caldo" : "Freddo",
        r.assets?.name ?? "—",
        r.temperature != null ? `${r.temperature}°C` : "—",
        r.outcome === "ok" ? "Conforme" : "Anomalia",
        r.notes ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5 && data.cell.raw === "Anomalia") {
          data.cell.styles.textColor = [200, 30, 30];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  function oilTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 52,
      head: [["Data/ora", "Friggitrice", "Azione", "Comp. polari %", "Esito", "Note"]],
      body: rows.map((r) => [
        new Date(r.checked_at).toLocaleString("it-IT"),
        r.fryer_name ?? r.assets?.name ?? "—",
        r.action === "change" ? "Sostituzione" : r.action === "filter" ? "Filtraggio" : "Verifica",
        r.polar_compounds != null ? `${r.polar_compounds}%` : "—",
        r.outcome === "ok" ? "Conforme" : "Anomalia",
        r.notes ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
    });
  }

  function preparationsTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 52,
      head: [["Data/ora", "Preparazione", "Conservazione", "Scadenza interna", "Ingredienti", "Note"]],
      body: rows.map((r) => [
        new Date(r.prepared_at).toLocaleString("it-IT"),
        r.name ?? "—",
        r.storage_type === "frigo" ? "Frigo" : r.storage_type === "freezer" ? "Freezer" : r.storage_type ?? "—",
        r.internal_expiry ? new Date(r.internal_expiry).toLocaleString("it-IT") : "—",
        r.ingredients_text ?? "—",
        r.notes ?? "",
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
    });
  }

  function emptyMsg(doc: jsPDF, text: string) {
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(text, doc.internal.pageSize.getWidth() / 2, 70, { align: "center" });
    doc.setTextColor(0);
  }

  async function generate(kind: ReportKey) {
    if (!user) return;
    setBusy(kind);
    try {
      const { start, end, label } = monthRange(ym);
      const logo = await logoDataUrl();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const addSection = async (title: string, fetcher: () => Promise<any[]>, renderer: (d: jsPDF, rows: any[]) => void, newPage = false) => {
        if (newPage) doc.addPage();
        drawHeader(doc, title, label, logo);
        const rows = await fetcher();
        if (rows.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato.");
        else renderer(doc, rows);
      };

      if (kind === "temperatures") {
        await addSection("Registro temperature", () => fetchTemperatures(start, end), tempTable);
      } else if (kind === "sanitations") {
        await addSection("Registro sanificazioni", () => fetchSanitations(start, end), sanitTable);
      } else if (kind === "production") {
        await addSection("Registro produzioni", () => fetchProduction(start, end), productionTable);
      } else if (kind === "incoming") {
        await addSection("Registro ingresso merci", () => fetchIncoming(start, end), incomingTable);
      } else if (kind === "blast_chillings") {
        await addSection("Registro abbattimenti", () => fetchBlastChillings(start, end), blastTable);
      } else if (kind === "holding") {
        await addSection("Registro mantenimento caldo/freddo", () => fetchHolding(start, end), holdingTable);
      } else if (kind === "oil_checks") {
        await addSection("Registro controllo olio frittura", () => fetchOilChecks(start, end), oilTable);
      } else if (kind === "preparations") {
        await addSection("Registro preparazioni / mise en place", () => fetchPreparations(start, end), preparationsTable);
      } else if (kind === "kitchen") {
        await addSection("Registro abbattimenti", () => fetchBlastChillings(start, end), blastTable);
        await addSection("Registro mantenimento caldo/freddo", () => fetchHolding(start, end), holdingTable, true);
        await addSection("Registro controllo olio frittura", () => fetchOilChecks(start, end), oilTable, true);
        await addSection("Registro preparazioni / mise en place", () => fetchPreparations(start, end), preparationsTable, true);
      } else if (kind === "full") {
        await addSection("Registro temperature", () => fetchTemperatures(start, end), tempTable);
        await addSection("Registro sanificazioni", () => fetchSanitations(start, end), sanitTable, true);
        await addSection("Registro produzioni", () => fetchProduction(start, end), productionTable, true);
        await addSection("Registro ingresso merci", () => fetchIncoming(start, end), incomingTable, true);
        await addSection("Registro abbattimenti", () => fetchBlastChillings(start, end), blastTable, true);
        await addSection("Registro mantenimento caldo/freddo", () => fetchHolding(start, end), holdingTable, true);
        await addSection("Registro controllo olio frittura", () => fetchOilChecks(start, end), oilTable, true);
        await addSection("Registro preparazioni / mise en place", () => fetchPreparations(start, end), preparationsTable, true);
      }

      drawSignatureBlock(doc);
      drawFooter(doc);

      const company_slug = (company.business_name ?? "azienda").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      doc.save(`HACCP_${kind}_${ym}_${company_slug}.pdf`);
      toast.success("Report generato");
    } catch (e: any) {
      toast.error(e?.message ?? "Errore nella generazione");
    } finally {
      setBusy(null);
    }
  }

  const items: { key: ReportKey; title: string; desc: string; icon: any; tone: string }[] = [
    { key: "temperatures", title: "Registro temperature", desc: "Tutte le rilevazioni di temperatura con range, esito ed operatore.", icon: Thermometer, tone: "from-blue-500 to-cyan-500" },
    { key: "sanitations", title: "Registro sanificazioni", desc: "Sanificazioni effettuate, prodotto usato ed operatore.", icon: Sparkles, tone: "from-emerald-500 to-teal-500" },
    { key: "production", title: "Registro produzioni", desc: "Prodotti realizzati, reparto, lotto interno e tipo di conservazione.", icon: Factory, tone: "from-orange-500 to-amber-500" },
    { key: "incoming", title: "Registro ingresso merci", desc: "DDT, fornitori, lotti, quantità e scadenze delle materie prime.", icon: Package, tone: "from-purple-500 to-fuchsia-500" },
    { key: "blast_chillings", title: "Registro abbattimenti", desc: "Cicli positivi/negativi, temperature inizio/fine ed esito.", icon: Snowflake, tone: "from-sky-500 to-indigo-500" },
    { key: "holding", title: "Mantenimento caldo/freddo", desc: "Verifiche di temperatura su prodotti in mantenimento.", icon: Thermometer, tone: "from-rose-500 to-pink-500" },
    { key: "oil_checks", title: "Controllo olio frittura", desc: "Verifiche, filtraggi e sostituzioni dell'olio di frittura.", icon: Droplet, tone: "from-yellow-500 to-orange-500" },
    { key: "preparations", title: "Preparazioni cucina", desc: "Mise en place, ingredienti, conservazione e scadenza interna.", icon: ChefHat, tone: "from-emerald-500 to-lime-500" },
  ];

  return (
    <div>
      <PageHeader title="Report HACCP" subtitle="Esporta i registri mensili pronti per il controllo ASL" />

      <Card className="p-4 mb-6 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label>Mese di riferimento</Label>
            <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
          </div>
          <Button
            onClick={() => generate("full")}
            disabled={!!busy}
            className="bg-gradient-primary gap-2"
            size="lg"
          >
            {busy === "full" ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
            Scarica registro completo
          </Button>
          <Button
            onClick={() => generate("kitchen")}
            disabled={!!busy}
            variant="outline"
            className="gap-2"
            size="lg"
          >
            {busy === "kitchen" ? <Loader2 className="animate-spin" size={18} /> : <ChefHat size={18} />}
            Registro Cucina
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it) => (
          <Card key={it.key} className="p-5 shadow-soft flex gap-4">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${it.tone} flex items-center justify-center shrink-0`}>
              <it.icon className="text-white" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold">{it.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 mb-3">{it.desc}</div>
              <Button
                size="sm"
                variant="outline"
                disabled={!!busy}
                onClick={() => generate(it.key)}
                className="gap-2"
              >
                {busy === it.key ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />}
                Genera PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}