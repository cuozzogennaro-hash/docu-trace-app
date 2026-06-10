import { useState, useEffect, useCallback } from "react";
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
import { FileText, Thermometer, Sparkles, Factory, Package, Loader2, FileDown, Snowflake, Flame, Droplet, ChefHat, ClipboardCheck, PenLine, X, Archive, Upload, ShieldCheck, Trash2, Building2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

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

  // Archived ASL packages (with optional uploaded signed PDF)
  type AslPackage = {
    id: string;
    period_label: string;
    period_start: string;
    period_end: string;
    original_pdf_path: string;
    signed_pdf_path: string | null;
    signed_uploaded_at: string | null;
    created_at: string;
  };
  const [archivedPackages, setArchivedPackages] = useState<AslPackage[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [signedUploadingId, setSignedUploadingId] = useState<string | null>(null);

  const loadArchivedPackages = useCallback(async () => {
    if (!user) return;
    setArchivedLoading(true);
    const { data, error } = await supabase
      .from("asl_packages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setArchivedPackages(data as AslPackage[]);
    setArchivedLoading(false);
  }, [user]);

  useEffect(() => { loadArchivedPackages(); }, [loadArchivedPackages]);

  async function downloadStorageFile(path: string, suggestedName: string) {
    const { data, error } = await supabase.storage.from("documents").download(path);
    if (error || !data) { toast.error("Impossibile scaricare il file"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = suggestedName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function uploadSignedForPackage(pkg: AslPackage, file: File) {
    if (!user) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Carica un file PDF (.pdf)");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File troppo grande (max 20 MB)");
      return;
    }
    setSignedUploadingId(pkg.id);
    try {
      const path = `${user.id}/asl-packages/${pkg.id}_firmato.pdf`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("asl_packages")
        .update({ signed_pdf_path: path, signed_uploaded_at: new Date().toISOString() })
        .eq("id", pkg.id);
      if (dbErr) throw dbErr;
      toast.success("PDF firmato archiviato");
      await loadArchivedPackages();
    } catch (e: any) {
      toast.error(e?.message ?? "Errore nel caricamento");
    } finally {
      setSignedUploadingId(null);
    }
  }

  async function deleteArchivedPackage(pkg: AslPackage) {
    if (!confirm(`Eliminare il pacchetto "${pkg.period_label}"? L'azione è irreversibile.`)) return;
    const paths = [pkg.original_pdf_path];
    if (pkg.signed_pdf_path) paths.push(pkg.signed_pdf_path);
    await supabase.storage.from("documents").remove(paths);
    const { error } = await supabase.from("asl_packages").delete().eq("id", pkg.id);
    if (error) { toast.error("Errore nell'eliminazione"); return; }
    toast.success("Pacchetto eliminato");
    await loadArchivedPackages();
  }

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
    // dynamic accent band
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 28, pageW, 1.5, "F");
    let x = 14;
    if (logo) {
      const maxH = 14;
      const ratio = logo.w / logo.h;
      const h = maxH;
      const w = h * ratio;
      try { doc.addImage(logo.data, "PNG", 14, 7, w, h); } catch {}
      x = 14 + w + 6;
    }
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(company.business_name ?? "Azienda", x, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const subParts = [company.vat && `P.IVA ${company.vat}`, company.address, company.city].filter(Boolean);
    doc.text(subParts.join(" • "), x, 18);
    // title block top-right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, pageW - 14, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Periodo: ${periodLabel}`, pageW - 14, 19, { align: "right" });
    doc.setTextColor(0);
  }

  function drawFooter(doc: jsPDF) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      // skip cover (page 1) to preserve dark design
      if (i === 1) continue;
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
      .select("event_date, recorded_at, temperature, operator, operator_id, notes, assets:asset_id(name, target_temp_min, target_temp_max)")
      .eq("user_id", user!.id)
      .gte("event_date", start)
      .lt("event_date", end)
      .order("event_date", { ascending: true })
      .order("recorded_at", { ascending: true });
    return await maskOperators(data ?? []);
  }
  async function fetchSanitations(start: string, end: string) {
    const { data } = await supabase
      .from("sanitations")
      .select("event_date, recorded_at, operator, operator_id, product_used, notes, assets:asset_id(name)")
      .eq("user_id", user!.id)
      .gte("event_date", start)
      .lt("event_date", end)
      .order("event_date", { ascending: true });
    return await maskOperators(data ?? []);
  }

  async function maskOperators(rows: any[]) {
    if (!rows.length) return rows;
    const ids = Array.from(new Set(rows.map((r) => r.operator_id).filter(Boolean)));
    if (!ids.length) return rows;
    const { data: ops } = await supabase
      .from("operators")
      .select("id, hide_in_reports")
      .in("id", ids);
    const hidden = new Set((ops ?? []).filter((o: any) => o.hide_in_reports).map((o: any) => o.id));
    if (!hidden.size) return rows;
    return rows.map((r) => (r.operator_id && hidden.has(r.operator_id) ? { ...r, operator: "Amministratore" } : r));
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

  function tempTable(doc: jsPDF, rows: any[], startY: number = 36) {
    autoTable(doc, {
      startY,
      head: [["Data", "Attrezzatura", "Range (°C)", "Temp. (°C)", "Esito", "Operatore", "Note"]],
      body: rows.map((r) => {
        const min = r.assets?.target_temp_min;
        const max = r.assets?.target_temp_max;
        const t = Number(r.temperature);
        let esito = r.__outOfService ? "FUORI SERVIZIO" : "—";
        if (!r.__outOfService && min != null && max != null) esito = t >= Number(min) && t <= Number(max) ? "OK" : "FUORI RANGE";
        return [
          formatDate(r.event_date),
          r.assets?.name ?? "—",
          min != null && max != null ? `${min} / ${max}` : "—",
          r.__outOfService || isNaN(t) ? "—" : t.toFixed(1),
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
        if (data.section === "body" && rows[data.row.index]?.__outOfService) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [254, 242, 242];
        }
      },
    });
  }

  function sanitTable(doc: jsPDF, rows: any[], startY: number = 36) {
    autoTable(doc, {
      startY,
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
      didParseCell: (data) => {
        if (data.section === "body" && rows[data.row.index]?.__outOfService) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [254, 242, 242];
        }
      },
    });
  }

  function productionTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 36,
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
      startY: 36,
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
      startY: 36,
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
      startY: 36,
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
      startY: 36,
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
      startY: 36,
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
    doc.text(text, doc.internal.pageSize.getWidth() / 2, 50, { align: "center" });
    doc.setTextColor(0);
  }

  // ====================== ASL PACKAGE ======================

  async function fetchOperatorsList() {
    const { data } = await supabase
      .from("operators")
      .select("name, role, is_active, is_admin, created_at")
      .eq("user_id", user!.id)
      .eq("hide_in_reports", false)
      .order("name");
    return (data ?? []) as any[];
  }
  async function fetchAssetsList() {
    const { data } = await supabase
      .from("assets")
      .select("name, asset_type, target_temp_min, target_temp_max, cleaning_product, department_id")
      .eq("user_id", user!.id)
      .order("name");
    return await attachDepartments(data ?? []);
  }
  async function fetchSuppliersList() {
    const { data } = await supabase
      .from("suppliers")
      .select("name, vat")
      .eq("user_id", user!.id)
      .order("name");
    return (data ?? []) as any[];
  }
  async function fetchNonConformities(start: string, end: string) {
    const { data } = await supabase
      .from("non_conformities")
      .select("detected_at, area, severity, status, title, description, corrective_action, resolved_at, asset_id, assets:asset_id(name)")
      .eq("user_id", user!.id)
      // Tutte le NC rilevanti per il periodo: rilevate nel periodo, OPPURE ancora aperte (anche se rilevate prima)
      .or(
        `and(detected_at.gte.${start}T00:00:00,detected_at.lt.${end}T00:00:00),and(status.eq.open,detected_at.lt.${end}T00:00:00)`
      )
      .order("detected_at", { ascending: true });
    return (data ?? []) as any[];
  }

  function normalizeAssetLookup(value: string | null | undefined) {
    return (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function oosAsset(row: any) {
    return row.assets ?? { name: row.title ?? "Attrezzatura non specificata", target_temp_min: null, target_temp_max: null };
  }

  // Returns equipment that was "out of service" (NC overlapping the period), including older NCs saved without a linked asset.
  // Used to add red rows on temperature/sanitation pages explaining why measurements are missing.
  async function fetchOutOfServiceAssets(start: string, end: string) {
    const { data } = await supabase
      .from("non_conformities")
      .select("asset_id, area, title, description, corrective_action, detected_at, resolved_at, status, assets:asset_id(name, target_temp_min, target_temp_max)")
      .eq("user_id", user!.id)
      // NC overlaps period: detected before end AND (still open OR resolved after start)
      .lt("detected_at", `${end}T00:00:00`)
      .or(`status.eq.open,resolved_at.gte.${start}T00:00:00`)
      .order("detected_at", { ascending: true });
    const rows = ((data ?? []) as any[]).filter((r) => r.asset_id || r.area === "attrezzatura");
    if (!rows.some((r) => !r.assets && r.title)) return rows;

    const { data: assets } = await supabase
      .from("assets")
      .select("id, name, target_temp_min, target_temp_max")
      .eq("user_id", user!.id);
    const byName = new Map(((assets ?? []) as any[]).map((a) => [normalizeAssetLookup(a.name), a]));

    return rows.map((r) => {
      if (r.assets || !r.title) return r;
      const match = byName.get(normalizeAssetLookup(r.title));
      return {
        ...r,
        asset_id: match?.id ?? r.asset_id,
        assets: match
          ? { name: match.name, target_temp_min: match.target_temp_min, target_temp_max: match.target_temp_max }
          : { name: r.title, target_temp_min: null, target_temp_max: null },
      };
    });
  }

  function outOfServiceNotice(doc: jsPDF, rows: any[]) {
    if (!rows.length) return 52;
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const lines = rows.map((r) => {
      const name = oosAsset(r).name ?? "—";
      const from = r.detected_at ? new Date(r.detected_at).toLocaleDateString("it-IT") : "";
      const to = r.status === "open" ? "in corso" : (r.resolved_at ? new Date(r.resolved_at).toLocaleDateString("it-IT") : "");
      const motivo = r.title ?? "Non conformità";
      return `• ${name} — fuori servizio dal ${from}${to ? ` al ${to}` : ""} (${motivo})`;
    });
    const text = lines.join("\n");
    const split = doc.splitTextToSize(text, pageW - margin * 2 - 8);
    const boxH = 12 + split.length * 4.2;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 80, 80);
    const y = 34;
    doc.roundedRect(margin, y, pageW - margin * 2, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(153, 27, 27);
    doc.text("Attrezzature fuori servizio nel periodo (non conformità)", margin + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text(split, margin + 4, y + 11);
    doc.setTextColor(0);
    return y + boxH + 6;
  }

  function dayOnly(value: string | null | undefined) {
    return value ? value.slice(0, 10) : "";
  }

  function endInclusive(end: string) {
    const d = new Date(`${end}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return fmtDay(d);
  }

  function oosPeriodLabel(row: any, start: string, end: string) {
    const from = dayOnly(row.detected_at) > start ? dayOnly(row.detected_at) : start;
    const periodEnd = endInclusive(end);
    const resolved = dayOnly(row.resolved_at);
    const to = resolved ? (resolved < periodEnd ? resolved : periodEnd) : periodEnd;
    return `${formatDate(from)} – ${row.status === "open" && !resolved ? "in corso" : formatDate(to)}`;
  }

  function oosDays(row: any, start: string, end: string) {
    const from = dayOnly(row.detected_at) > start ? dayOnly(row.detected_at) : start;
    const periodEnd = endInclusive(end);
    const resolved = dayOnly(row.resolved_at);
    const to = resolved ? (resolved < periodEnd ? resolved : periodEnd) : periodEnd;
    const days: string[] = [];
    const current = new Date(`${from}T00:00:00Z`);
    const last = new Date(`${to}T00:00:00Z`);
    while (current <= last) {
      days.push(fmtDay(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return days;
  }

  function withOutOfServiceTemperatureRows(rows: any[], oosRows: any[], start: string, end: string) {
    const synthetic = oosRows.flatMap((r) => oosDays(r, start, end).map((day) => ({
      __outOfService: true,
      __sortDate: day,
      event_date: day,
      assets: oosAsset(r),
      temperature: null,
      operator: "—",
      notes: `FUORI SERVIZIO (${oosPeriodLabel(r, start, end)}) — NC: ${r.title ?? "Non conformità"}${r.description ? ` — ${r.description}` : ""}`,
    })));
    return [...rows, ...synthetic].sort((a, b) => String(a.__sortDate ?? a.event_date).localeCompare(String(b.__sortDate ?? b.event_date)));
  }

  function withOutOfServiceSanitationRows(rows: any[], oosRows: any[], start: string, end: string) {
    const synthetic = oosRows.flatMap((r) => oosDays(r, start, end).map((day) => ({
      __outOfService: true,
      __sortDate: day,
      event_date: day,
      assets: oosAsset(r),
      product_used: "FUORI SERVIZIO",
      operator: "—",
      notes: `Sanificazione sospesa (${oosPeriodLabel(r, start, end)}) — NC: ${r.title ?? "Non conformità"}`,
    })));
    return [...rows, ...synthetic].sort((a, b) => String(a.__sortDate ?? a.event_date).localeCompare(String(b.__sortDate ?? b.event_date)));
  }

  function drawAslCover(doc: jsPDF, periodLabel: string, logo: Awaited<ReturnType<typeof logoDataUrl>>) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    // Sfondo a due tonalità (dinamico, landscape)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW * 0.42, pageH, "F");
    // accento
    doc.setFillColor(59, 130, 246);
    doc.rect(pageW * 0.42 - 1.5, 0, 1.5, pageH, "F");

    // Logo grande in alto a sinistra
    if (logo) {
      const maxH = 40;
      const ratio = logo.w / logo.h;
      const h = maxH;
      const w = h * ratio;
      const cx = pageW * 0.21;
      try { doc.addImage(logo.data, "PNG", cx - w / 2, 30, w, h); } catch {}
    }

    // Blocco azienda nella colonna sinistra
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(company.business_name ?? "—", pageW * 0.21, logo ? 85 : 60, { align: "center", maxWidth: pageW * 0.38 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200);
    let y = (logo ? 85 : 60) + 10;
    if (company.vat) { doc.text(`P.IVA ${company.vat}`, pageW * 0.21, y, { align: "center" }); y += 5; }
    const addr = [company.address, company.city].filter(Boolean).join(" — ");
    if (addr) { doc.text(addr, pageW * 0.21, y, { align: "center", maxWidth: pageW * 0.38 }); y += 5; }
    if (company.phone) { doc.text(`Tel ${company.phone}`, pageW * 0.21, y, { align: "center" }); y += 5; }
    if (company.email) { doc.text(company.email, pageW * 0.21, y, { align: "center" }); }

    // Colonna destra: titolo + periodo
    const rx = pageW * 0.42 + 18;
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("DOCUMENTO HACCP", rx, 50);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.text("Pacchetto", rx, 70);
    doc.text("Ispezione ASL", rx, 86);

    // banda colorata sotto il titolo
    doc.setFillColor(59, 130, 246);
    doc.rect(rx, 92, 50, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(203, 213, 225);
    doc.text("Documentazione di autocontrollo — Reg. CE 852/2004 e Reg. UE 1169/2011", rx, 104, { maxWidth: pageW - rx - 18 });

    // Box periodo + data
    const boxY = 125;
    doc.setDrawColor(59, 130, 246);
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(rx, boxY, pageW - rx - 18, 38, 3, 3, "FD");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.text("PERIODO DI RIFERIMENTO", rx + 8, boxY + 9);
    doc.text("DATA EMISSIONE", rx + (pageW - rx - 18) / 2 + 4, boxY + 9);
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(periodLabel, rx + 8, boxY + 22, { maxWidth: (pageW - rx - 18) / 2 - 12 });
    doc.text(new Date().toLocaleDateString("it-IT"), rx + (pageW - rx - 18) / 2 + 4, boxY + 22);

    // Footer cover
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Il presente documento riepiloga le registrazioni HACCP del periodo. Costituisce documentazione di autocontrollo ai sensi della normativa vigente.",
      pageW / 2,
      pageH - 14,
      { align: "center", maxWidth: pageW - 40 },
    );
    doc.setTextColor(0);
  }

  function drawAslIndex(doc: jsPDF, sections: { title: string; page: number }[]) {
    const pageW = doc.internal.pageSize.getWidth();
    // Banda titolo
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 22, pageW, 1.5, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Indice del documento", 14, 14);
    doc.setTextColor(0);
    doc.setFontSize(11);
    let y = 38;
    sections.forEach((s, i) => {
      doc.setFont("helvetica", "normal");
      doc.text(`${i + 1}. ${s.title}`, 20, y);
      // dotted leader
      const tw = doc.getTextWidth(`${i + 1}. ${s.title}`);
      const dotsStart = 20 + tw + 4;
      const dotsEnd = pageW - 30;
      doc.setTextColor(180);
      let x = dotsStart;
      while (x < dotsEnd) { doc.text(".", x, y); x += 2; }
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(String(s.page), pageW - 20, y, { align: "right" });
      y += 9;
    });
  }

  function operatorsTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 36,
      head: [["Nome", "Ruolo", "Stato", "Permessi", "Attivo dal"]],
      body: rows.map((r) => [
        r.name ?? "—",
        r.role ?? "—",
        r.is_active ? "Attivo" : "Disattivo",
        r.is_admin ? "Amministratore" : "Operatore",
        formatDate(r.created_at),
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
    });
  }

  function assetsTable(doc: jsPDF, rows: any[]) {
    // Raggruppa per reparto e ordina per nome
    const sorted = [...rows].sort((a, b) => {
      const da = (a.departments?.name ?? "ZZZ_Senza reparto").localeCompare(b.departments?.name ?? "ZZZ_Senza reparto", "it");
      if (da !== 0) return da;
      return (a.name ?? "").localeCompare(b.name ?? "", "it");
    });
    const body: any[] = [];
    let lastDept: string | null = null;
    sorted.forEach((r) => {
      const dept = r.departments?.name ?? "Senza reparto";
      if (dept !== lastDept) {
        body.push([{
          content: dept.toUpperCase(),
          colSpan: 4,
          styles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
            halign: "left",
          },
        }]);
        lastDept = dept;
      }
      body.push([
        r.name ?? "—",
        r.asset_type ?? "—",
        r.target_temp_min != null && r.target_temp_max != null
          ? `${r.target_temp_min} / ${r.target_temp_max}`
          : "—",
        r.cleaning_product ?? "—",
      ]);
    });
    autoTable(doc, {
      startY: 36,
      head: [["Attrezzatura", "Tipo", "Range temp. (°C)", "Prodotto sanificante"]],
      body,
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    });
  }

  function suppliersTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 36,
      head: [["Fornitore", "P.IVA"]],
      body: rows.map((r) => [r.name ?? "—", r.vat ?? "—"]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
    });
  }

  function ncTable(doc: jsPDF, rows: any[]) {
    autoTable(doc, {
      startY: 36,
      head: [["Data", "Attrezzatura", "Area", "Gravità", "Titolo", "Descrizione", "Azione correttiva", "Stato", "Risolta il"]],
      body: rows.map((r) => [
        formatDate(r.detected_at),
        r.assets?.name ?? (r.area === "attrezzatura" ? r.title : "—"),
        r.area ?? "—",
        (r.severity ?? "—").toUpperCase(),
        r.title ?? "—",
        r.description ?? "—",
        r.corrective_action ?? "—",
        r.status === "open" ? "Aperta" : r.status === "in_progress" ? "In corso" : "Chiusa",
        formatDate(r.resolved_at),
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fillColor: [60, 60, 80], textColor: 255 },
      columnStyles: { 4: { cellWidth: 32 }, 5: { cellWidth: 48 }, 6: { cellWidth: 48 } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const v = String(data.cell.raw ?? "");
          if (v === "HIGH" || v === "CRITICAL") {
            data.cell.styles.textColor = [200, 30, 30];
            data.cell.styles.fontStyle = "bold";
          }
        }
        if (data.section === "body" && data.column.index === 7 && data.cell.raw === "Aperta") {
          data.cell.styles.textColor = [200, 30, 30];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  type SummaryStats = {
    tempTotal: number; tempInRange: number; tempOutOfRange: number;
    sanitTotal: number;
    productionTotal: number;
    incomingTotal: number;
    blastTotal: number; blastAnomalies: number;
    holdingTotal: number; holdingAnomalies: number;
    oilTotal: number; oilAnomalies: number;
    prepTotal: number;
    ncTotal: number; ncOpen: number; ncClosed: number;
  };

  function computeSummary(buckets: {
    temps: any[]; sanit: any[]; prods: any[]; inc: any[]; blast: any[]; hold: any[]; oils: any[]; preps: any[]; ncs: any[];
  }): SummaryStats {
    let inR = 0, outR = 0;
    buckets.temps.forEach((r) => {
      const min = r.assets?.target_temp_min;
      const max = r.assets?.target_temp_max;
      const t = Number(r.temperature);
      if (min != null && max != null && !isNaN(t)) {
        if (t >= Number(min) && t <= Number(max)) inR++; else outR++;
      }
    });
    return {
      tempTotal: buckets.temps.length,
      tempInRange: inR,
      tempOutOfRange: outR,
      sanitTotal: buckets.sanit.length,
      productionTotal: buckets.prods.length,
      incomingTotal: buckets.inc.length,
      blastTotal: buckets.blast.length,
      blastAnomalies: buckets.blast.filter((r) => r.outcome !== "ok").length,
      holdingTotal: buckets.hold.length,
      holdingAnomalies: buckets.hold.filter((r) => r.outcome !== "ok").length,
      oilTotal: buckets.oils.length,
      oilAnomalies: buckets.oils.filter((r) => r.outcome !== "ok").length,
      prepTotal: buckets.preps.length,
      ncTotal: buckets.ncs.length,
      ncOpen: buckets.ncs.filter((r) => r.status === "open" || r.status === "in_progress").length,
      ncClosed: buckets.ncs.filter((r) => r.status === "resolved" || r.status === "closed" || r.resolved_at).length,
    };
  }

  function drawSummarySection(doc: jsPDF, s: SummaryStats) {
    const pageW = doc.internal.pageSize.getWidth();
    // KPI cards grid
    const cards: { label: string; value: string; tone?: "ok" | "warn" | "neutral" }[] = [
      { label: "Rilevazioni temperatura", value: String(s.tempTotal), tone: "neutral" },
      { label: "Conformi", value: String(s.tempInRange), tone: "ok" },
      { label: "Fuori range", value: String(s.tempOutOfRange), tone: s.tempOutOfRange > 0 ? "warn" : "ok" },
      { label: "Sanificazioni registrate", value: String(s.sanitTotal), tone: "neutral" },
      { label: "Produzioni / lotti emessi", value: String(s.productionTotal), tone: "neutral" },
      { label: "Ingressi merce", value: String(s.incomingTotal), tone: "neutral" },
      { label: "Abbattimenti", value: `${s.blastTotal} (${s.blastAnomalies} anom.)`, tone: s.blastAnomalies > 0 ? "warn" : "ok" },
      { label: "Holding caldo/freddo", value: `${s.holdingTotal} (${s.holdingAnomalies} anom.)`, tone: s.holdingAnomalies > 0 ? "warn" : "ok" },
      { label: "Controlli olio frittura", value: `${s.oilTotal} (${s.oilAnomalies} anom.)`, tone: s.oilAnomalies > 0 ? "warn" : "ok" },
      { label: "Preparazioni / mise en place", value: String(s.prepTotal), tone: "neutral" },
      { label: "Non conformità totali", value: String(s.ncTotal), tone: s.ncTotal > 0 ? "warn" : "ok" },
      { label: "Non conformità aperte", value: String(s.ncOpen), tone: s.ncOpen > 0 ? "warn" : "ok" },
      { label: "Non conformità chiuse", value: String(s.ncClosed), tone: "ok" },
    ];
    const cols = 5;
    const gap = 4;
    const margin = 14;
    const cw = (pageW - margin * 2 - gap * (cols - 1)) / cols;
    const ch = 24;
    let x = margin, y = 40;
    cards.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      x = margin + col * (cw + gap);
      y = 40 + row * (ch + gap);
      // tone fill
      if (c.tone === "warn") doc.setFillColor(254, 242, 242);
      else if (c.tone === "ok") doc.setFillColor(240, 253, 244);
      else doc.setFillColor(248, 250, 252);
      doc.setDrawColor(220);
      doc.roundedRect(x, y, cw, ch, 2, 2, "FD");
      // barra accento sinistra
      if (c.tone === "warn") doc.setFillColor(239, 68, 68);
      else if (c.tone === "ok") doc.setFillColor(34, 197, 94);
      else doc.setFillColor(59, 130, 246);
      doc.rect(x, y, 1.8, ch, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      if (c.tone === "warn") doc.setTextColor(185, 28, 28);
      else if (c.tone === "ok") doc.setTextColor(21, 128, 61);
      else doc.setTextColor(30, 41, 59);
      doc.text(c.value, x + 5, y + 12);
      doc.setTextColor(80);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(c.label, x + 5, y + 19, { maxWidth: cw - 10 });
      doc.setTextColor(0);
    });

    // Conformity rate
    const rateY = y + ch + 14;
    const pct = s.tempTotal > 0 ? Math.round((s.tempInRange / s.tempTotal) * 1000) / 10 : 100;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Tasso di conformità temperatura nel periodo", margin, rateY);
    // bar
    const barW = pageW - margin * 2;
    const barH = 8;
    doc.setFillColor(238, 242, 247);
    doc.rect(margin, rateY + 4, barW, barH, "F");
    const fillW = Math.max(0, Math.min(1, pct / 100)) * barW;
    if (pct >= 95) doc.setFillColor(34, 197, 94);
    else if (pct >= 80) doc.setFillColor(234, 179, 8);
    else doc.setFillColor(239, 68, 68);
    doc.rect(margin, rateY + 4, fillW, barH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.text(`${pct.toFixed(1)}%`, pageW - margin, rateY + 10, { align: "right" });
    doc.setTextColor(0);
  }

  function drawSignaturePage(doc: jsPDF, signatureData: string | null) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Dichiarazione del responsabile dell'autocontrollo", pageW / 2, 20, { align: "center" });
    doc.setDrawColor(220);
    doc.line(20, 25, pageW - 20, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const text =
      `Il sottoscritto, in qualità di responsabile dell'autocontrollo igienico-sanitario di ${company.business_name ?? "________________"}, ` +
      `dichiara che le registrazioni contenute nel presente documento sono veritiere, complete e relative alle attività svolte nel periodo indicato in copertina. ` +
      `Le procedure di autocontrollo sono state attuate secondo il piano HACCP aziendale, in conformità al Reg. CE 852/2004 e successive modifiche. ` +
      `Eventuali non conformità rilevate sono state oggetto di idonea azione correttiva, come documentato nelle sezioni dedicate del presente fascicolo.`;
    doc.text(text, 20, 35, { maxWidth: pageW - 40, lineHeightFactor: 1.4 });

    // Signature row: place/date | firma | timbro on the same line so nothing
    // overflows the page bottom (A4 landscape pageH ≈ 210mm; footer at pageH-8).
    const sigBoxY = 80;
    const sigBoxH = 45;
    const gap = 8;
    const colW = (pageW - 40 - gap * 2) / 3;

    // 1) Place / date
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Luogo e data", 20, sigBoxY);
    doc.setDrawColor(120);
    doc.line(20, sigBoxY + sigBoxH, 20 + colW, sigBoxY + sigBoxH);
    const placeDate = `${company.city ?? ""}${company.city ? ", " : ""}${new Date().toLocaleDateString("it-IT")}`;
    doc.setFont("helvetica", "normal");
    doc.text(placeDate, 20, sigBoxY + sigBoxH - 2);

    // 2) Signature
    const rx = 20 + colW + gap;
    doc.setFont("helvetica", "bold");
    doc.text("Firma del responsabile", rx, sigBoxY);
    doc.line(rx, sigBoxY + sigBoxH, rx + colW, sigBoxY + sigBoxH);
    if (signatureData) {
      try {
        doc.addImage(signatureData, "PNG", rx + 4, sigBoxY + 6, colW - 8, sigBoxH - 10);
      } catch {}
    }

    // 3) Stamp area (same row, kept above footer)
    const sx = rx + colW + gap;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Timbro aziendale", sx, sigBoxY);
    doc.setDrawColor(200);
    doc.roundedRect(sx, sigBoxY + 4, colW, sigBoxH - 4, 2, 2, "S");

    // Closing note above footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "Documento prodotto ai sensi del Reg. CE 852/2004 — autocontrollo HACCP",
      pageW / 2,
      pageH - 16,
      { align: "center" },
    );
    doc.setTextColor(0);
  }

  async function handleSignatureFile(file: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Immagine troppo grande (max 2 MB)");
      return;
    }
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setAslSignatureData(data);
    toast.success("Firma caricata");
  }

  async function generateAslPackage() {
    if (!user) return;
    setAslBusy(true);
    try {
      const { start, end, label } = aslPeriodRange(aslPeriodKind, aslCustomStart, aslCustomEnd);
      const logo = await logoDataUrl();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // ---- COVER ----
      drawAslCover(doc, label, logo);

      // ---- Fetch all data ----
      const [temps, sanit, prods, inc, blast, hold, oils, preps, ncs, operatorsRows, assetsRows, suppliersRows, oosAssets] = await Promise.all([
        fetchTemperatures(start, end),
        fetchSanitations(start, end),
        fetchProduction(start, end),
        fetchIncoming(start, end),
        fetchBlastChillings(start, end),
        fetchHolding(start, end),
        fetchOilChecks(start, end),
        fetchPreparations(start, end),
        fetchNonConformities(start, end),
        aslIncludeAnagrafiche ? fetchOperatorsList() : Promise.resolve([]),
        aslIncludeAnagrafiche ? fetchAssetsList() : Promise.resolve([]),
        aslIncludeAnagrafiche ? fetchSuppliersList() : Promise.resolve([]),
        fetchOutOfServiceAssets(start, end),
      ]);
      const tempsWithOos = withOutOfServiceTemperatureRows(temps, oosAssets, start, end);
      const sanitWithOos = withOutOfServiceSanitationRows(sanit, oosAssets, start, end);

      // Switch to landscape for tables, keep cover/index/signature portrait? Mix is awkward.
      // To keep it simple: from here on we add landscape pages by re-creating sections with addPage({orientation}).
      // jsPDF supports per-page orientation via addPage(format, orientation).

      type Section = { title: string; render: () => void };
      const sections: Section[] = [];

      if (aslIncludeAnagrafiche) {
        sections.push({
          title: "Anagrafica operatori",
          render: () => {
            drawHeader(doc, "Anagrafica operatori abilitati", label, logo);
            if (operatorsRows.length === 0) emptyMsg(doc, "Nessun operatore configurato.");
            else operatorsTable(doc, operatorsRows);
          },
        });
        sections.push({
          title: "Attrezzature e punti di controllo",
          render: () => {
            drawHeader(doc, "Attrezzature e punti di controllo", label, logo);
            if (assetsRows.length === 0) emptyMsg(doc, "Nessuna attrezzatura configurata.");
            else assetsTable(doc, assetsRows);
          },
        });
        sections.push({
          title: "Fornitori",
          render: () => {
            drawHeader(doc, "Elenco fornitori", label, logo);
            if (suppliersRows.length === 0) emptyMsg(doc, "Nessun fornitore registrato.");
            else suppliersTable(doc, suppliersRows);
          },
        });
      }

      if (aslIncludeSummary) {
        const summary = computeSummary({ temps, sanit, prods, inc, blast, hold, oils, preps, ncs });
        sections.push({
          title: "Sintesi del periodo",
          render: () => {
            drawHeader(doc, "Sintesi del periodo", label, logo);
            drawSummarySection(doc, summary);
          },
        });
      }

      sections.push({ title: "Registro temperature", render: () => {
        drawHeader(doc, "Registro temperature", label, logo);
        const sy = outOfServiceNotice(doc, oosAssets);
        if (tempsWithOos.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato.");
        else tempTable(doc, tempsWithOos, sy);
      } });
      sections.push({ title: "Registro sanificazioni", render: () => {
        drawHeader(doc, "Registro sanificazioni", label, logo);
        const sy = outOfServiceNotice(doc, oosAssets);
        if (sanitWithOos.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato.");
        else sanitTable(doc, sanitWithOos, sy);
      } });
      sections.push({ title: "Registro produzioni", render: () => { drawHeader(doc, "Registro produzioni", label, logo); if (prods.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato."); else productionTable(doc, prods); } });
      sections.push({ title: "Registro ingresso merci", render: () => { drawHeader(doc, "Registro ingresso merci", label, logo); if (inc.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato."); else incomingTable(doc, inc); } });
      sections.push({ title: "Registro abbattimenti", render: () => { drawHeader(doc, "Registro abbattimenti", label, logo); if (blast.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato."); else blastTable(doc, blast); } });
      sections.push({ title: "Mantenimento caldo/freddo", render: () => { drawHeader(doc, "Mantenimento caldo/freddo", label, logo); if (hold.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato."); else holdingTable(doc, hold); } });
      sections.push({ title: "Controllo olio frittura", render: () => { drawHeader(doc, "Controllo olio frittura", label, logo); if (oils.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato."); else oilTable(doc, oils); } });
      sections.push({ title: "Preparazioni / mise en place", render: () => { drawHeader(doc, "Preparazioni / mise en place", label, logo); if (preps.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato."); else preparationsTable(doc, preps); } });

      if (aslIncludeNc) {
        sections.push({
          title: "Non conformità e azioni correttive",
          render: () => {
            drawHeader(doc, "Non conformità e azioni correttive", label, logo);
            if (ncs.length === 0) emptyMsg(doc, "Nessuna non conformità rilevata nel periodo selezionato.");
            else ncTable(doc, ncs);
          },
        });
      }

      sections.push({
        title: "Dichiarazione e firma",
        render: () => drawSignaturePage(doc, aslSignatureData),
      });

      // Reserve index page (page 2)
      doc.addPage("a4", "landscape");
      const indexPageNumber = doc.getNumberOfPages();

      // Render sections, recording page numbers
      const indexEntries: { title: string; page: number }[] = [];
      for (const s of sections) {
        doc.addPage("a4", "landscape");
        indexEntries.push({ title: s.title, page: doc.getNumberOfPages() });
        s.render();
      }

      // Photo appendix
      if (aslIncludePhotos) {
        const withPhotos = (inc as any[]).filter((r) => r.document_image_url).slice(0, 30);
        if (withPhotos.length > 0) {
          doc.addPage("a4", "landscape");
          indexEntries.push({ title: "Allegati fotografici DDT", page: doc.getNumberOfPages() });
          drawHeader(doc, "Allegati fotografici DDT", label, logo);
          let py = 40;
          const pageW = doc.internal.pageSize.getWidth();
          const pageH = doc.internal.pageSize.getHeight();
          for (const r of withPhotos) {
            try {
              const res = await fetch(r.document_image_url);
              const blob = await res.blob();
              const data: string = await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onloadend = () => resolve(fr.result as string);
                fr.onerror = reject;
                fr.readAsDataURL(blob);
              });
              const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = reject;
                i.src = data;
              });
              const maxW = pageW - 28;
              const maxH = 80;
              const ratio = img.naturalWidth / img.naturalHeight;
              let w = maxW, h = maxW / ratio;
              if (h > maxH) { h = maxH; w = h * ratio; }
              if (py + h + 16 > pageH - 14) {
                doc.addPage("a4", "landscape");
                drawHeader(doc, "Allegati fotografici DDT", label, logo);
                py = 40;
              }
              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              doc.text(`${r.supplier_name ?? "—"} — DDT ${r.document_number ?? "—"} (${formatDate(r.document_date ?? r.created_at)})`, 14, py);
              try { doc.addImage(data, "JPEG", 14, py + 3, w, h); } catch {
                try { doc.addImage(data, "PNG", 14, py + 3, w, h); } catch {}
              }
              py += h + 12;
            } catch { /* skip broken image */ }
          }
        }
      }

      // Now render the index on the reserved page
      doc.setPage(indexPageNumber);
      drawAslIndex(doc, indexEntries);

      // Footer on all pages (skip cover)
      drawFooter(doc);

      const company_slug = (company.business_name ?? "azienda").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const fileLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const fileName = `HACCP_ispezione-asl_${fileLabel}_${company_slug}.pdf`;

      // Get PDF as blob for storage + download
      const pdfBlob: Blob = doc.output("blob");

      // Archive to storage + DB (best-effort: never block local download)
      try {
        if (user) {
          const pkgId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
          const path = `${user.id}/asl-packages/${pkgId}_originale.pdf`;
          const { error: upErr } = await supabase.storage.from("documents").upload(path, pdfBlob, {
            contentType: "application/pdf",
            upsert: false,
          });
          if (upErr) throw upErr;
          const { error: insErr } = await supabase.from("asl_packages").insert({
            id: pkgId,
            user_id: user.id,
            period_label: label,
            period_start: start,
            period_end: end,
            original_pdf_path: path,
          });
          if (insErr) throw insErr;
          await loadArchivedPackages();
        }
      } catch (archiveErr: any) {
        console.error("ASL archive error", archiveErr);
        toast.error("Pacchetto generato ma non archiviato: " + (archiveErr?.message ?? "errore"));
      }

      // Trigger local download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Pacchetto Ispezione ASL generato e archiviato");
    } catch (e: any) {
      toast.error(e?.message ?? "Errore nella generazione");
    } finally {
      setAslBusy(false);
    }
  }

  // ====================== /ASL PACKAGE ======================

  async function generate(kind: ReportKey) {
    if (!user) return;
    setBusy(kind);
    try {
      const { start, end, label } = monthRange(ym);
      const logo = await logoDataUrl();
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const oosAssets = await fetchOutOfServiceAssets(start, end);
      const addSection = async (
        title: string,
        fetcher: () => Promise<any[]>,
        renderer: (d: jsPDF, rows: any[], startY?: number) => void,
        newPage = false,
        withOos = false,
      ) => {
        if (newPage) doc.addPage();
        drawHeader(doc, title, label, logo);
        let sy = 36;
        if (withOos && oosAssets.length) {
          sy = outOfServiceNotice(doc, oosAssets);
        }
        const rows = await fetcher();
        if (rows.length === 0) emptyMsg(doc, "Nessuna registrazione nel periodo selezionato.");
        else renderer(doc, rows, sy);
      };

      if (kind === "temperatures") {
        await addSection("Registro temperature", async () => withOutOfServiceTemperatureRows(await fetchTemperatures(start, end), oosAssets, start, end), tempTable, false, true);
      } else if (kind === "sanitations") {
        await addSection("Registro sanificazioni", async () => withOutOfServiceSanitationRows(await fetchSanitations(start, end), oosAssets, start, end), sanitTable, false, true);
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
        await addSection("Registro temperature", async () => withOutOfServiceTemperatureRows(await fetchTemperatures(start, end), oosAssets, start, end), tempTable, false, true);
        await addSection("Registro sanificazioni", async () => withOutOfServiceSanitationRows(await fetchSanitations(start, end), oosAssets, start, end), sanitTable, true, true);
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

      {/* ASL inspection package */}
      <Card className="p-5 mb-6 shadow-elevated border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-start gap-4 mb-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
            <ClipboardCheck className="text-primary-foreground" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-lg">Pacchetto Ispezione ASL</div>
            <div className="text-sm text-muted-foreground">
              Tutto quello che serve per il controllo in un unico PDF firmabile: copertina, anagrafiche, sintesi, registri, non conformità e pagina firma.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label>Periodo</Label>
            <Select value={aslPeriodKind} onValueChange={(v) => setAslPeriodKind(v as AslPeriodKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Ultimo mese</SelectItem>
                <SelectItem value="quarter">Trimestre in corso</SelectItem>
                <SelectItem value="year">Anno in corso</SelectItem>
                <SelectItem value="custom">Personalizzato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {aslPeriodKind === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label>Dal</Label>
                <Input type="date" value={aslCustomStart} onChange={(e) => setAslCustomStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Al</Label>
                <Input type="date" value={aslCustomEnd} onChange={(e) => setAslCustomEnd(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={aslIncludeAnagrafiche} onCheckedChange={(v) => setAslIncludeAnagrafiche(!!v)} />
            Anagrafiche
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={aslIncludeSummary} onCheckedChange={(v) => setAslIncludeSummary(!!v)} />
            Sintesi & anomalie
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={aslIncludeNc} onCheckedChange={(v) => setAslIncludeNc(!!v)} />
            Non conformità
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={aslIncludePhotos} onCheckedChange={(v) => setAslIncludePhotos(!!v)} />
            Foto DDT allegate
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <PenLine size={16} className="text-primary" />
            Firma del responsabile (opzionale)
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSignatureFile(f); }}
              className="max-w-xs"
            />
            {aslSignatureData && (
              <>
                <img src={aslSignatureData} alt="Anteprima firma" className="h-10 border rounded bg-white p-1" />
                <Button variant="ghost" size="icon" onClick={() => setAslSignatureData(null)} aria-label="Rimuovi firma">
                  <X size={16} />
                </Button>
              </>
            )}
          </div>
        </div>

        <Button
          onClick={generateAslPackage}
          disabled={aslBusy || !!busy}
          size="lg"
          className="w-full sm:w-auto bg-gradient-primary gap-2"
        >
          {aslBusy ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
          Genera Pacchetto Ispezione ASL
        </Button>
      </Card>

      {/* Archived ASL packages — with optional uploaded digital signature */}
      <Card className="p-5 mb-6 shadow-soft">
        <div className="flex items-start gap-4 mb-4">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Archive className="text-muted-foreground" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-lg">Pacchetti ASL archiviati</div>
            <div className="text-sm text-muted-foreground">
              Ogni pacchetto generato viene archiviato qui. Puoi scaricare l'originale, firmarlo digitalmente (firma PAdES con il tuo dispositivo / software) e ricaricare il file <strong>.pdf</strong> firmato per conservarlo insieme all'originale.
            </div>
          </div>
        </div>

        {archivedLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="animate-spin" size={14} /> Caricamento…
          </div>
        ) : archivedPackages.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">Nessun pacchetto archiviato. Genera il primo qui sopra.</div>
        ) : (
          <div className="space-y-3">
            {archivedPackages.map((pkg) => (
              <div key={pkg.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{pkg.period_label}</div>
                  <div className="text-xs text-muted-foreground">
                    Generato il {new Date(pkg.created_at).toLocaleString("it-IT")}
                    {pkg.signed_uploaded_at && (
                      <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                        <ShieldCheck size={12} /> firmato il {new Date(pkg.signed_uploaded_at).toLocaleDateString("it-IT")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => downloadStorageFile(pkg.original_pdf_path, `ASL_${pkg.period_label}_originale.pdf`)}
                  >
                    <FileDown size={14} /> Originale
                  </Button>
                  {pkg.signed_pdf_path ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-emerald-300"
                      onClick={() => downloadStorageFile(pkg.signed_pdf_path!, `ASL_${pkg.period_label}_firmato.pdf`)}
                    >
                      <ShieldCheck size={14} /> Firmato
                    </Button>
                  ) : (
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadSignedForPackage(pkg, f);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5 pointer-events-none"
                        disabled={signedUploadingId === pkg.id}
                      >
                        {signedUploadingId === pkg.id ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                        Carica PDF firmato
                      </Button>
                    </label>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Elimina pacchetto"
                    onClick={() => deleteArchivedPackage(pkg)}
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 mb-6 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-1.5 flex-1 max-w-xs">
            <Label>Registri singoli — mese di riferimento</Label>
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