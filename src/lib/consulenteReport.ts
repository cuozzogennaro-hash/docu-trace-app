import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export type ConsulenteReportResult = {
  filename: string;
  totalRows: number;
};

/**
 * Generates a HACCP report PDF for a specific client (used by Consulente).
 * Pulls temperatures, sanitations and assets filtered by the client user_id
 * and triggers a browser download.
 */
export async function generateClientHaccpReport(
  clientUserId: string,
  clientName: string | null,
): Promise<ConsulenteReportResult> {
  const [tRes, sRes, aRes] = await Promise.all([
    supabase
      .from("temperatures")
      .select("event_date, recorded_at, temperature, operator, asset_id, notes")
      .eq("user_id", clientUserId)
      .order("recorded_at", { ascending: false })
      .limit(1000),
    supabase
      .from("sanitations")
      .select("event_date, recorded_at, operator, product_used, asset_id, notes")
      .eq("user_id", clientUserId)
      .order("recorded_at", { ascending: false })
      .limit(1000),
    supabase.from("assets").select("id, name").eq("user_id", clientUserId),
  ]);

  if (tRes.error) throw tRes.error;
  if (sRes.error) throw sRes.error;
  if (aRes.error) throw aRes.error;

  const assetMap: Record<string, string> = {};
  (aRes.data ?? []).forEach((a: { id: string; name: string }) => {
    assetMap[a.id] = a.name;
  });

  const temps = tRes.data ?? [];
  const sans = sRes.data ?? [];
  const totalRows = temps.length + sans.length;

  if (totalRows === 0) {
    throw new Error("Nessun registro disponibile per questo cliente.");
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const generatedAt = new Date().toLocaleString("it-IT");
  const title = clientName || "Cliente";

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Report HACCP — Registri Cliente", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Azienda: ${title}`, 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generato il ${generatedAt} — Vista Consulente / Supervisore`, 14, 32);
  doc.setTextColor(0);

  // Temperatures
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Registro Temperature", 14, 42);

  if (temps.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Nessuna rilevazione registrata.", 14, 48);
    doc.setTextColor(0);
  } else {
    autoTable(doc, {
      startY: 46,
      head: [["Data", "Ora rilevazione", "Attrezzatura", "Operatore", "Temp. (°C)", "Note"]],
      body: temps.map((t: any) => [
        fmtDate(t.event_date),
        fmtDateTime(t.recorded_at),
        assetMap[t.asset_id] || "—",
        t.operator || "—",
        Number(t.temperature).toFixed(1),
        t.notes || "",
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 64, 175] },
      columnStyles: { 4: { halign: "right" } },
    });
  }

  // Sanitations
  const afterTemps =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 48;
  let y = afterTemps + 10;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Registro Sanificazioni", 14, y);

  if (sans.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("Nessuna sanificazione registrata.", 14, y + 6);
    doc.setTextColor(0);
  } else {
    autoTable(doc, {
      startY: y + 4,
      head: [["Data", "Ora registrazione", "Attrezzatura / Area", "Operatore", "Prodotto", "Note"]],
      body: sans.map((s: any) => [
        fmtDate(s.event_date),
        fmtDateTime(s.recorded_at),
        assetMap[s.asset_id] || "—",
        s.operator || "—",
        s.product_used || "—",
        s.notes || "",
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [13, 148, 136] },
    });
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Pagina ${i} di ${pageCount}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" },
    );
  }

  const filename = `HACCP_report_${slugify(title)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return { filename, totalRows };
}