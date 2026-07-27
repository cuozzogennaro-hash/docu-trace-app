import jsPDF from "jspdf";
import { savePdfDocument } from "@/lib/nativeShare";

export type DeclarationCompany = {
  business_name: string | null;
  vat: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
};

export type DeclarationInput = {
  legalRep: string;
  sector: string;
  province: string;
  scia: string;
  hygieneManager: string;
  recipient: string;
  place: string;
  date: string; // yyyy-mm-dd
  includePestControl: boolean;
  includeTraceability: boolean;
  includeAllergens: boolean;
  includeWater: boolean;
  includeSupplierChecks: boolean;
};

const BLUE: [number, number, number] = [0, 86, 179];

function line(doc: jsPDF, text: string, x: number, y: number, maxW: number, lh = 5.2): number {
  const lines = doc.splitTextToSize(text, maxW) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lh;
}

async function logoData(url: string | null): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
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

function fill(value: string | null | undefined, width = 40): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : "_".repeat(width);
}

export async function generateHaccpDeclarationPdf(
  company: DeclarationCompany,
  input: DeclarationInput,
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;
  const contentW = pageW - M * 2;

  const logo = await logoData(company.logo_url);

  // ---- Header
  let y = 18;
  if (logo) {
    const h = 16;
    const w = h * (logo.w / logo.h);
    try { doc.addImage(logo.data, "PNG", M, y - 6, Math.min(w, 45), h); } catch {}
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BLUE);
  doc.text("DICHIARAZIONE DI CONFORMITÀ IGIENICO-SANITARIA", pageW / 2, y + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text(
    "(Ai sensi del Reg. CE 852/2004, Reg. CE 178/2002 e della normativa nazionale vigente)",
    pageW / 2,
    y + 11.5,
    { align: "center" },
  );
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(M, y + 15, pageW - M, y + 15);
  doc.setLineWidth(0.2);
  doc.setTextColor(50);
  y += 22;

  // ---- Anagrafica
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const rows = [
    `Il sottoscritto ${fill(input.legalRep, 45)},`,
    `in qualità di Legale Rappresentante dell'azienda ${fill(company.business_name, 35)},`,
    `con sede in ${fill([company.address, company.city].filter(Boolean).join(" — "), 35)}  Prov. (${fill(input.province, 4)}),`,
    `P.IVA / Codice Fiscale ${fill(company.vat, 30)},`,
    `operante nel settore ${fill(input.sector, 35)},`,
  ];
  const contacts = [company.phone && `Tel. ${company.phone}`, company.email].filter(Boolean).join("  •  ");
  if (contacts) rows.push(`Recapiti: ${contacts}`);
  for (const r of rows) y = line(doc, r, M, y, contentW, 5) + 0.5;

  y += 2;
  y = line(
    doc,
    "sotto la propria responsabilità e pienamente consapevole delle sanzioni previste dalla legge in caso di dichiarazioni mendaci,",
    M,
    y,
    contentW,
  );

  // ---- DICHIARA
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text("DICHIARA E ATTESTA", M, y);
  doc.setTextColor(50);
  y += 5;

  const points: string[] = [
    "che l'azienda ha predisposto, implementato e mantiene attivo un Piano di Autocontrollo Igienico-Sanitario redatto secondo i principi del sistema HACCP (Hazard Analysis and Critical Control Points), in conformità al Regolamento CE n. 852/2004;",
    "che le procedure operative, le buone prassi igieniche (GHP/GMP) e il monitoraggio dei punti critici di controllo (CCP) sono costantemente applicati, registrati, verificati e riesaminati periodicamente;",
    "che tutto il personale addetto alla manipolazione, allo stoccaggio o al trasporto degli alimenti ha ricevuto adeguata formazione e addestramento in materia di igiene alimentare, secondo le specifiche normative regionali vigenti;",
    `che l'attività è regolarmente registrata presso l'Autorità Sanitaria Competente tramite Notifica Sanitaria (SCIA)${input.scia.trim() ? ` — estremi: ${input.scia.trim()}` : ""};`,
  ];
  if (input.includeTraceability)
    points.push("che è attivo un sistema di rintracciabilità dei lotti in entrata e in uscita, ai sensi dell'art. 18 del Reg. CE 178/2002, che consente il ritiro/richiamo dei prodotti secondo procedure documentate;");
  if (input.includeAllergens)
    points.push("che è attiva una procedura di gestione degli allergeni e delle informazioni sugli alimenti ai consumatori, conforme al Reg. UE 1169/2011, con evidenza in etichetta delle sostanze allergeniche;");
  if (input.includeSupplierChecks)
    points.push("che i fornitori sono sottoposti a qualifica e verifica documentale (DDT, lotti, temperature di consegna, idoneità sanitaria) con registrazione degli esiti dei controlli in accettazione;");
  if (input.includePestControl)
    points.push("che sono attuati un piano di sanificazione e un piano di lotta agli infestanti (pest control) documentati, con registrazione degli interventi e dei prodotti impiegati;");
  if (input.includeWater)
    points.push("che l'acqua utilizzata nel processo produttivo proviene da rete pubblica potabile e/o è sottoposta a verifiche di potabilità documentate;");
  points.push("che le non conformità eventualmente rilevate sono gestite tramite azioni correttive documentate e verificate a cura del responsabile dell'autocontrollo;");
  points.push("che le registrazioni dell'autocontrollo sono conservate e rese disponibili all'Autorità di controllo ufficiale ai sensi del Reg. UE 2017/625.");

  // Highlight box
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  const measure = (t: string) => (doc.splitTextToSize(t, contentW - 14) as string[]).length;
  const boxH = points.reduce((acc, p) => acc + measure(p) * 3.9 + 1.6, 0) + 5;
  doc.setFillColor(248, 249, 250);
  doc.rect(M, y, contentW, boxH, "F");
  doc.setFillColor(...BLUE);
  doc.rect(M, y, 1.5, boxH, "F");
  let by = y + 6;
  for (const p of points) {
    doc.setTextColor(...BLUE);
    doc.text("•", M + 5, by);
    doc.setTextColor(50);
    const lines = doc.splitTextToSize(p, contentW - 14) as string[];
    doc.text(lines, M + 9, by);
    by += lines.length * 3.9 + 1.6;
  }
  y += boxH + 5;

  doc.setFontSize(10);
  const recipient = input.recipient.trim();
  y = line(
    doc,
    `La presente dichiarazione viene rilasciata${recipient ? ` a ${recipient}` : " su richiesta del cliente"} per gli usi consentiti dalla legge e nell'ambito dei rapporti commerciali di fornitura B2B.`,
    M,
    y,
    contentW,
  );
  y += 2;
  if (input.hygieneManager.trim()) {
    y = line(doc, `Responsabile dell'autocontrollo HACCP: ${input.hygieneManager.trim()}.`, M, y, contentW);
  }
  y += 2;
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  y = line(
    doc,
    "La presente dichiarazione ha validità 12 mesi dalla data di sottoscrizione, salvo variazioni sostanziali dell'attività, dei locali o del piano di autocontrollo.",
    M,
    y,
    contentW,
    4,
  );
  doc.setTextColor(50);

  // ---- Firma (nuova pagina se non c'è spazio sufficiente)
  let sigY: number;
  if (y > pageH - 48) {
    doc.addPage();
    sigY = 40;
  } else {
    sigY = Math.max(y + 14, pageH - 50);
  }
  const dateStr = input.date ? new Date(input.date).toLocaleDateString("it-IT") : "";
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50);
  doc.text("Luogo e data", M, sigY);
  doc.setFont("helvetica", "normal");
  doc.text(`${fill(input.place || company.city, 22)}, il ${fill(dateStr, 12)}`, M, sigY + 10);

  const rx = pageW / 2 + 5;
  doc.setFont("helvetica", "bold");
  doc.text("Il Legale Rappresentante", rx, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text("(Timbro e firma leggibile)", rx, sigY + 4.5);
  doc.setTextColor(50);
  doc.setDrawColor(80);
  doc.line(rx, sigY + 20, pageW - M, sigY + 20);

  // ---- Footer su tutte le pagine
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(
      `${company.business_name ?? "Azienda"} — Documento generato il ${new Date().toLocaleString("it-IT")}`,
      M,
      pageH - 10,
    );
    doc.text(`Pagina ${i} di ${total}`, pageW - M, pageH - 10, { align: "right" });
  }

  const slug = (company.business_name ?? "azienda")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  await savePdfDocument(doc, `Dichiarazione_Conformita_HACCP_${slug}.pdf`);
}
