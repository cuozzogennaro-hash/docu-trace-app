import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Bluetooth, FileDown, Loader2, Printer } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const { departments } = useDepartments();
  const [product, setProduct] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelTemplates, setLabelTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [labelQty, setLabelQty] = useState(1);
  const [btPrinting, setBtPrinting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: prod } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      setProduct(prod);

      const { data: links } = await supabase
        .from("product_ingredients")
        .select("raw_materials(id, product_name, internal_lot, supplier_name, supplier_lot, origin, quantity, expiry_date, category, born_in, raised_in, slaughtered_in, meat_type, slaughter_mark, ingredients)")
        .eq("product_id", id);

      setIngredients((links ?? []).map((l: any) => l.raw_materials).filter(Boolean));

      // Load label templates
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tpls } = await supabase.from("label_templates").select("*").eq("user_id", user.id).order("created_at");
        setLabelTemplates(tpls ?? []);
        const def = (tpls ?? []).find((t: any) => t.is_default);
        if (def) setSelectedTemplate(def.id);
        else if (tpls && tpls.length > 0) setSelectedTemplate(tpls[0].id);
      }

      setLoading(false);
    })();
  }, [id]);

  const PX_PER_MM = 3.78;

  // Mappa parole chiave -> nome carne usato in etichetta
  const MEAT_KEYWORDS: Record<string, string> = {
    tacchino: "tacchino",
    pollo: "pollo",
    gallina: "gallina",
    cappone: "cappone",
    manzo: "manzo",
    bovino: "bovino",
    bovina: "bovino",
    vitello: "vitello",
    vitellone: "vitellone",
    suino: "suino",
    maiale: "suino",
    agnello: "agnello",
    pecora: "pecora",
    capra: "capra",
    capretto: "capretto",
    coniglio: "coniglio",
    cavallo: "cavallo",
    anatra: "anatra",
    oca: "oca",
    faraona: "faraona",
    cinghiale: "cinghiale",
    struzzo: "struzzo",
    quaglia: "quaglia",
  };

  function detectMeat(name: string): string | null {
    const n = (name || "").toLowerCase();
    for (const k of Object.keys(MEAT_KEYWORDS)) {
      if (n.includes(k)) return MEAT_KEYWORDS[k];
    }
    return null;
  }

  type IngPart = { text: string; bold: boolean };

  function getValueMap() {
    const meats: IngPart[] = [];
    const aromas: IngPart[] = [];
    const additives: IngPart[] = [];
    const others: IngPart[] = [];

    for (const m of ingredients as any[]) {
      const cat = m.category || "materia_prima";
      if (cat === "aroma") {
        aromas.push({ text: m.product_name, bold: false });
      } else if (cat === "additivo_allergene") {
        // additivi e allergeni: in grassetto come da norma
        additives.push({ text: m.product_name, bold: true });
      } else {
          const meat = detectMeat(m.product_name);
          const origin = (m.origin && String(m.origin).trim()) || "UE";
          const subIngredients = (m.ingredients && String(m.ingredients).trim()) || "";
          if (meat) {
            meats.push({ text: `carne di ${meat} (${origin})`, bold: false });
          } else if (subIngredients) {
            // Materia prima già lavorata (es. Salumeria): in etichetta riportiamo
            // SOLO la sua lista ingredienti, non il nome del prodotto.
            subIngredients
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((ing) => others.push({ text: ing, bold: false }));
          } else {
            others.push({ text: `${m.product_name} (${origin})`, bold: false });
          }
      }
    }

    const parts: IngPart[] = [...meats, ...others, ...aromas, ...additives];
    const ingredientsList = parts.map((p) => p.text).join(", ");
    return {
      valueMap: {
        company_name: company?.business_name ?? "",
        product_name: product?.name ?? "",
        internal_lot: `Lotto: ${product?.internal_lot ?? ""}`,
        production_date: `Data prod.: ${product?.production_date ?? "—"}`,
        expiry_date: `Scadenza: ${ingredients[0]?.expiry_date ?? "—"}`,
        ingredients: `Ingr.: ${ingredientsList || "—"}`,
        company_address: company?.address ?? "",
      } as Record<string, string>,
      ingredientParts: parts,
    };
  }

  // ---------- Layout etichetta (sorgente unica condivisa) ----------
  // Formato data GG/MM/AA
  function formatDateDDMMYY(s?: string | null): string {
    if (!s) return "—";
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = String(d.getFullYear()).slice(-2);
      return `${dd}/${mm}/${yy}`;
    }
    return s;
  }

  type LabelSeg = { text: string; bold: boolean };
  type LabelItem = {
    x: number; y: number; w: number; // mm
    fontPt: number;
    align: "left" | "center" | "right";
    segments: LabelSeg[];
    lineHeight: number;
  };

  function computeLabelLayout(wMm: number, hMm: number) {
    const { ingredientParts } = getValueMap();
    // Traceability for Macelleria, driven by the PRODUCT's meat_type:
    // - "preparato": simplified "<nome> origine: <origin>"
    // - otherwise (fresh / default): Nato / Allevato / Macellato + Bollo CE
    const productMeatType: string | null = (product as any)?.meat_type ?? null;
    const productDeptName = (departments.find((d) => d.id === (product as any)?.department_id)?.name || "").toLowerCase().trim();
    const isSalumeria = productDeptName.startsWith("salum");
    // Salumeria: scadenza automatica = data produzione + 30 giorni
    let salumeriaExpiry = "";
    if (isSalumeria && product?.production_date) {
      const pd = new Date(String(product.production_date) + "T00:00:00");
      if (!isNaN(pd.getTime())) {
        pd.setDate(pd.getDate() + 30);
        salumeriaExpiry = formatDateDDMMYY(pd.toISOString().slice(0, 10));
      }
    }
    const freshMap = new Map<string, { born: Set<string>; raised: Set<string>; slaughter: Set<string>; marks: Set<string> }>();
    const prepCountries = new Set<string>();
    for (const m of ingredients as any[]) {
      const name = m.product_name || "carne";
      if (productMeatType === "preparato") {
        [m.born_in, m.raised_in, m.slaughtered_in].forEach((v: string | null) => {
          const t = (v || "").trim();
          if (t) prepCountries.add(t);
        });
        continue;
      }
      if (!m.born_in && !m.raised_in && !m.slaughtered_in && !m.slaughter_mark) continue;
      if (!freshMap.has(name)) freshMap.set(name, { born: new Set(), raised: new Set(), slaughter: new Set(), marks: new Set() });
      const t = freshMap.get(name)!;
      if (m.born_in) t.born.add(m.born_in);
      if (m.raised_in) t.raised.add(m.raised_in);
      if (m.slaughtered_in) t.slaughter.add(m.slaughtered_in);
      if (m.slaughter_mark) t.marks.add(m.slaughter_mark);
    }
    // Linee tracciabilità:
    // - fresh: una riga per Nato, Allevato, Macellato (con bollo accanto, senza "Bollo CE:")
    // - preparato: singola riga "Carne origine: IT/UE"
    const freshLines: string[] = [];
    freshMap.forEach((t) => {
      if (t.born.size) freshLines.push(`Nato in: ${[...t.born].join("/")}`);
      if (t.raised.size) freshLines.push(`Allevato in: ${[...t.raised].join("/")}`);
      if (t.slaughter.size) {
        const slaughter = `Macellato in: ${[...t.slaughter].join("/")}`;
        const mark = t.marks.size ? ` ${[...t.marks].join("/")}` : "";
        freshLines.push(slaughter + mark);
      }
    });
    const traceLines: string[] = [];
    if (productMeatType === "preparato" && prepCountries.size > 0) {
      const norm = [...prepCountries].map((c) => c.toLowerCase().trim());
      const allItaly = norm.every((c) => c === "italia" || c === "italy" || c === "it");
      traceLines.push(`Carne origine: ${allItaly ? "IT" : "UE"}`);
    }
    const data = {
      companyName: company?.business_name ?? "",
      productName: product?.name ?? "",
      ingredients: ingredientParts,
      traceLines,
      freshLines,
      productionDate: formatDateDDMMYY(product?.production_date),
      internalLot: product?.internal_lot ?? "—",
      salumeriaExpiry,
    };

    // Padding proporzionale (min 1.2mm)
    const p = Math.max(1.2, Math.min(wMm, hMm) * 0.04);
    // Margine di sicurezza extra sul lato destro: la CT221D ha un piccolo
    // bordo non stampabile e il rendering canvas può eccedere di una frazione
    // di mm rispetto a measureText. Senza questo le ultime lettere/cifre
    // dei testi centrati o allineati a destra vengono troncate.
    const safetyR = Math.max(3, wMm * 0.04);
    // Dimensioni font in pt — scalano con altezza etichetta
    const titlePtBase = Math.max(10, Math.round(hMm * 0.34));
    const companyPtBase = Math.max(9, Math.round(hMm * 0.28));
    const ingrPt = Math.max(7, Math.round(hMm * 0.22));
    const footerPtBase = Math.max(7, Math.round(hMm * 0.22));
    const lh = 1.2;
    const ptMm = (pt: number) => pt * 0.3528;

    // Misuratore canvas off-screen per auto-fit del font su singola riga
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d")!;
    const measureWidthMm = (text: string, pt: number, bold: boolean) => {
      // 1pt = 0.3528mm, ma per misurare uso px coerenti tra loro
      const px = pt * 4; // scala arbitraria, conta solo il rapporto
      measureCtx.font = `${bold ? "bold " : ""}${px}px Helvetica, Arial, sans-serif`;
      const wPx = measureCtx.measureText(text).width;
      // wPx corrisponde a (pt*4)px → in mm: (wPx / (pt*4)) * pt * 0.3528
      return (wPx / (pt * 4)) * pt * 0.3528;
    };
    const fitPt = (text: string, maxMm: number, startPt: number, minPt: number, bold: boolean) => {
      let pt = startPt;
      while (pt > minPt && measureWidthMm(text, pt, bold) > maxMm) pt -= 0.5;
      return Math.max(minPt, pt);
    };

    // Auto-fit titoli per stare su una riga sola; usa la stessa dimensione
    // (la più piccola fra i due) così che mantengano lo stesso formato.
    const titleMaxMm = wMm - 2 * p - safetyR;
    const titleCompanyPt = fitPt(data.companyName || " ", titleMaxMm, companyPtBase, 8, true);
    const titleProductPt = fitPt(data.productName || " ", titleMaxMm, titlePtBase, 8, true);
    const productPt = titleProductPt;
    const companyPt = Math.min(titleCompanyPt, companyPtBase);

    // Footer: la metà di larghezza ciascuno; auto-fit per evitare overflow
    const footerLeftW = (wMm - 2 * p - safetyR) / 2 - 0.5;
    const footerRightW = (wMm - 2 * p - safetyR) / 2 - 0.5;
    const dataText = `Data Pro.: ${data.productionDate}`;
    const lotText = `Lotto: ${data.internalLot}`;
    const footerPt = Math.min(
      fitPt(dataText, footerLeftW, footerPtBase, 6, false),
      fitPt(lotText, footerRightW, footerPtBase, 6, true),
    );

    const items: LabelItem[] = [];
    let y = p;

    // Nome società
    items.push({
      x: p, y, w: wMm - 2 * p - safetyR,
      fontPt: companyPt, align: "center", lineHeight: lh,
      segments: [{ text: data.companyName, bold: true }],
    });
    y += ptMm(companyPt) * lh + 0.5;

    // Nome prodotto (stesso formato)
    items.push({
      x: p, y, w: wMm - 2 * p - safetyR,
      fontPt: productPt, align: "center", lineHeight: lh,
      segments: [{ text: data.productName, bold: true }],
    });
    y += ptMm(productPt) * lh + 0.6;

    // Footer: data prod (sx) + lotto (dx)
    const footerH = ptMm(footerPt) * lh;
    const footerY = hMm - p - footerH;

    // Tracciabilità carne (prima degli ingredienti)
    if (data.freshLines.length > 0) {
      data.freshLines.forEach((line) => {
        items.push({
          x: p, y, w: wMm - 2 * p - safetyR,
          fontPt: ingrPt, align: "left", lineHeight: lh,
          segments: [{ text: line, bold: true }],
        });
        y += ptMm(ingrPt) * lh + 0.2;
      });
      y += 0.3;
    }

    // Ingredienti (riempiono lo spazio fra titolo e footer)
    // Per Carne Fresca (monocomponente) NON stampiamo gli ingredienti:
    // l'etichetta riporta solo la tracciabilità (Nato/Allevato/Macellato).
    if (productMeatType !== "fresh") {
      const ingrSegs: LabelSeg[] = [{ text: "Ingr.: ", bold: true }];
      data.ingredients.forEach((ing, i) => {
        const sep = i < data.ingredients.length - 1 ? ", " : "";
        ingrSegs.push({ text: ing.text + sep, bold: ing.bold });
      });
      if (data.ingredients.length === 0) ingrSegs.push({ text: "—", bold: false });
      items.push({
        x: p, y, w: wMm - 2 * p - safetyR,
        fontPt: ingrPt, align: "left", lineHeight: lh,
        segments: ingrSegs,
      });
    }

    // Data produzione (in basso a sinistra)
    // Avvisi macelleria (sopra la riga data/lotto), su una sola riga senza wrap
    if (productMeatType) {
      const noticeText = "Conservare da 0° e +4° — Consumare previa cottura";
      const noticePt = fitPt(noticeText, wMm - 2 * p - safetyR, Math.max(5, footerPt * 0.82), 4, false);
      const noticeH = ptMm(noticePt) * lh;
      const noticeY = footerY - noticeH - 0.6;
      items.push({
        x: p, y: noticeY, w: wMm - 2 * p - safetyR,
        fontPt: noticePt, align: "center", lineHeight: lh,
        segments: [{ text: noticeText, bold: false }],
      });
    }

    items.push({
      x: p, y: footerY, w: footerLeftW,
      fontPt: footerPt, align: "left", lineHeight: lh,
      segments: [{ text: dataText, bold: false }],
    });
    // Lotto (in basso a destra) — termina a (wMm - p - safetyR)
    items.push({
      x: wMm - p - safetyR - footerRightW, y: footerY, w: footerRightW,
      fontPt: footerPt, align: "right", lineHeight: lh,
      segments: [{ text: lotText, bold: true }],
    });

    // Salumeria: riga scadenza (sopra la riga data/lotto)
    if (data.salumeriaExpiry) {
      const expiryText = `Da consumarsi entro: ${data.salumeriaExpiry}`;
      const expiryPt = fitPt(expiryText, wMm - 2 * p - safetyR, footerPt, 6, true);
      const expiryH = ptMm(expiryPt) * lh;
      const expiryY = footerY - expiryH - 0.4;
      items.push({
        x: p, y: expiryY, w: wMm - 2 * p - safetyR,
        fontPt: expiryPt, align: "right", lineHeight: lh,
        segments: [{ text: expiryText, bold: true }],
      });
    }

    return items;
  }

  async function printLabel() {
    if (!product) return;
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
    if (!tpl) { toast.error("Seleziona un template"); return; }

    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);
    const items = computeLabelLayout(wMm, hMm);

    // Build HTML for one label
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const renderItem = (it: LabelItem) => {
      const segHtml = it.segments
        .map((s) => `<span style="font-weight:${s.bold ? 700 : 400}">${escapeHtml(s.text)}</span>`)
        .join("");
      const style = `position:absolute;left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;font-size:${it.fontPt}pt;line-height:${it.lineHeight};text-align:${it.align};word-break:break-word;white-space:${it.align === "left" ? "normal" : "nowrap"};overflow:hidden;`;
      return `<div style="${style}">${segHtml}</div>`;
    };
    const labelHtml = items.map(renderItem).join("");
    const labelsHtml = Array.from({ length: labelQty })
      .map(
        () =>
          `<div class="label" style="position:relative;width:${wMm}mm;height:${hMm}mm;overflow:hidden;page-break-after:always;">${labelHtml}</div>`,
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etichetta</title>
<style>
  @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: Helvetica, Arial, sans-serif; color: #000; }
  .label { box-sizing: border-box; }
  @media screen {
    body { padding: 12px; background: #f5f5f5; }
    .label { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin: 0 auto 12px; }
    .actions { position: fixed; top: 8px; right: 8px; display: flex; gap: 8px; z-index: 10; }
    .actions button { padding: 10px 16px; font-size: 14px; border: 0; border-radius: 8px; background: #0a7; color: #fff; }
  }
  @media print {
    .actions { display: none !important; }
    body { padding: 0; background: #fff; }
    .label { box-shadow: none; margin: 0; }
  }
</style></head>
<body>
<div class="actions"><button onclick="window.print()">Stampa</button></div>
${labelsHtml}
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;

    // Open in a new tab — works on both desktop and mobile, lets the system print menu open.
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      // Fallback: data URL navigation (mobile popup-blocked case)
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
    }
    setShowLabelDialog(false);
  }

  // ---------- Bluetooth printing (CLABEL 221D / TSPL) ----------

  // Common BLE service/characteristic UUIDs used by thermal label printers
  // (CLABEL 221D, Xprinter, many TSPL/ESC-POS printers expose a generic
  // "Nordic UART"–style serial profile under one of these UUIDs).
  const BT_SERVICE_UUIDS = [
    "000018f0-0000-1000-8000-00805f9b34fb",
    "0000ff00-0000-1000-8000-00805f9b34fb",
    "0000ffe0-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  ];

  function strToBytes(s: string) {
    // CLABEL/TSPL uses CP437/Latin1 for accented chars in Italian.
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }

  function concatBytes(chunks: Uint8Array[]) {
    const len = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  }

  // Carica un'immagine in modo asincrono per renderizzarla su canvas
  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  // Renderizza l'etichetta su un canvas monocromatico alla risoluzione
  // esatta della stampante (CLABEL CT221D = 203 dpi = 8 dots/mm) in modo
  // che la stampa sia identica al pixel rispetto al preview.
  async function buildTSPL(): Promise<Uint8Array> {
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
    if (!tpl) throw new Error("Template non selezionato");
    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);
    const items = computeLabelLayout(wMm, hMm);

    const DPMM = 8; // 203 dpi
    const widthDots = Math.round(wMm * DPMM);
    const heightDots = Math.round(hMm * DPMM);

    // 1 pt = 1/72 inch = 203/72 dots ≈ 2.819 dots
    const ptToDots = (pt: number) => pt * (203 / 72);
    const mmToDots = (mm: number) => mm * DPMM;

    const canvas = document.createElement("canvas");
    canvas.width = widthDots;
    canvas.height = heightDots;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, widthDots, heightDots);
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    const fontFamily = "Helvetica, Arial, sans-serif";
    const setFont = (px: number, bold: boolean) => {
      ctx.font = `${bold ? "bold " : ""}${px}px ${fontFamily}`;
    };

    // Disegno parole con wrap; ritorna y finale
    const drawWrapped = (
      segments: { text: string; bold: boolean }[],
      xStart: number,
      yStart: number,
      maxWidth: number,
      lineHeight: number,
      px: number,
    ) => {
      // Espandi parole preservando il flag bold per ogni parola
      type Tok = { word: string; bold: boolean; trailingSpace: boolean };
      const tokens: Tok[] = [];
      segments.forEach((seg, segIdx) => {
        const words = seg.text.split(/\s+/).filter((w) => w.length > 0);
        words.forEach((w, i) => {
          tokens.push({
            word: w,
            bold: seg.bold,
            trailingSpace: i < words.length - 1 || segIdx < segments.length - 1,
          });
        });
      });

      let x = xStart;
      let y = yStart;
      const spaceW = (() => {
        setFont(px, false);
        return ctx.measureText(" ").width;
      })();

      for (const tok of tokens) {
        setFont(px, tok.bold);
        const w = ctx.measureText(tok.word).width;
        if (x + w > xStart + maxWidth && x > xStart) {
          x = xStart;
          y += lineHeight;
        }
        ctx.fillText(tok.word, x, y);
        x += w;
        if (tok.trailingSpace) x += spaceW;
      }
      return y + lineHeight;
    };

    // Disegno layout fisso
    for (const it of items) {
      const x = mmToDots(it.x);
      const y = mmToDots(it.y);
      const px = ptToDots(it.fontPt);
      const lineHeight = px * it.lineHeight;
      const maxWidth = mmToDots(it.w);

      if (it.align === "left") {
        drawWrapped(it.segments, x, y, maxWidth, lineHeight, px);
      } else {
        // Allineamento single-line: misuro larghezza totale e calcolo offset
        let total = 0;
        for (const s of it.segments) {
          setFont(px, s.bold);
          total += ctx.measureText(s.text).width;
        }
        const offset = it.align === "center"
          ? Math.max(0, (maxWidth - total) / 2)
          : Math.max(0, maxWidth - total);
        let cx = x + offset;
        for (const s of it.segments) {
          setFont(px, s.bold);
          ctx.fillText(s.text, cx, y);
          cx += ctx.measureText(s.text).width;
        }
      }
    }

    // Conversione canvas → bitmap monocromatica (1 bpp, MSB-first, 0=black)
    const imgData = ctx.getImageData(0, 0, widthDots, heightDots);
    const widthBytes = Math.ceil(widthDots / 8);
    const bitmap = new Uint8Array(widthBytes * heightDots);
    bitmap.fill(0xff); // tutto bianco
    for (let py = 0; py < heightDots; py++) {
      for (let px2 = 0; px2 < widthDots; px2++) {
        const i = (py * widthDots + px2) * 4;
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        const a = imgData.data[i + 3];
        // Luminance threshold; pixel "scuro" → bit 0 (black)
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) * (a / 255) + 255 * (1 - a / 255);
        if (lum < 160) {
          const byteIdx = py * widthBytes + (px2 >> 3);
          const bit = 7 - (px2 & 7);
          bitmap[byteIdx] &= ~(1 << bit);
        }
      }
    }

    // Composizione comando TSPL: header testuale + BITMAP + dati binari + footer
    const enc = new TextEncoder();
    const header = enc.encode(
      [
        `SIZE ${wMm} mm,${hMm} mm`,
        `GAP 2 mm,0 mm`,
        `DIRECTION 1`,
        `CLS`,
        `BITMAP 0,0,${widthBytes},${heightDots},0,`,
      ].join("\r\n") + "",
    );
    // La riga BITMAP termina dopo la virgola: i dati binari seguono direttamente
    // (così come da specifica TSPL), poi CRLF e PRINT.
    const footer = enc.encode(`\r\nPRINT ${labelQty},1\r\n`);

    const total = new Uint8Array(header.length + bitmap.length + footer.length);
    total.set(header, 0);
    total.set(bitmap, header.length);
    total.set(footer, header.length + bitmap.length);
    return total;
  }

  async function findWritableCharacteristic(server: any) {
    for (const uuid of BT_SERVICE_UUIDS) {
      try {
        const svc = await server.getPrimaryService(uuid);
        const chars = await svc.getCharacteristics();
        const c = chars.find((ch) => ch.properties.write || ch.properties.writeWithoutResponse);
        if (c) return c;
      } catch { /* try next */ }
    }
    // Fallback: scan all primary services
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      const c = chars.find((ch) => ch.properties.write || ch.properties.writeWithoutResponse);
      if (c) return c;
    }
    throw new Error("Nessuna caratteristica scrivibile trovata sulla stampante");
  }

  async function printLabelBluetooth() {
    if (!product) return;
    if (!selectedTemplate) { toast.error("Seleziona un template"); return; }
    const nav: any = navigator;
    if (!nav?.bluetooth) {
      toast.error("Web Bluetooth non supportato. Usa Chrome/Edge su Android o desktop.");
      return;
    }
    try {
      setBtPrinting(true);
      toast.message("Ricerca dispositivi Bluetooth…");
      const device: any = await nav.bluetooth.requestDevice({
        // Show all devices so any CLABEL 221D variant is selectable
        acceptAllDevices: true,
        optionalServices: BT_SERVICE_UUIDS,
      });
      if (!device.gatt) throw new Error("GATT non disponibile");
      toast.message(`Connessione a ${device.name ?? "stampante"}…`);
      const server = await device.gatt.connect();
      const ch = await findWritableCharacteristic(server);

      const data = await buildTSPL();
      // Strategia ibrida ad alta velocità:
      // - chunk grandi (100 byte) via writeWithoutResponse (veloce, no ack)
      // - ogni N chunk un writeValue con response come "barriera" di flow-control
      //   (svuota la coda BLE evitando pacchetti persi su Android)
      // Risultato: ~5–10x più veloce di solo write-with-response, mantenendo
      // affidabilità su Android.
      const isAndroid = /Android/i.test(navigator.userAgent);
      // Su Android serve un buon margine: chunk più piccoli e barriere
      // di flow-control più frequenti per evitare pacchetti persi.
      const CHUNK = isAndroid ? 60 : 100;
      const SYNC_EVERY = isAndroid ? 4 : 16;
      const supportsWoR = ch.properties.writeWithoutResponse;
      const supportsWithR = ch.properties.write;
      toast.message(`Invio ${data.length} byte alla stampante…`);
      let chunkIdx = 0;
      for (let i = 0; i < data.length; i += CHUNK) {
        const slice = data.slice(i, i + CHUNK);
        const isLast = i + CHUNK >= data.length;
        const isSyncPoint = (chunkIdx + 1) % SYNC_EVERY === 0 || isLast;
        if (supportsWoR && !isSyncPoint) {
          await ch.writeValueWithoutResponse(slice);
        } else if (supportsWithR) {
          await ch.writeValue(slice);
        } else {
          await ch.writeValueWithoutResponse(slice);
        }
        chunkIdx++;
      }
      toast.success("Etichetta inviata alla stampante");
      try { device.gatt.disconnect(); } catch { /* ignore */ }
      setShowLabelDialog(false);
    } catch (e: any) {
      console.error("[BT print]", e);
      toast.error(e?.message ?? "Errore stampa Bluetooth");
    } finally {
      setBtPrinting(false);
    }
  }

  function downloadPdf() {
    if (!product) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    doc.setFontSize(16);
    doc.text("Scheda Prodotto", 14, 20);
    doc.setFontSize(10);
    if (company?.business_name) doc.text(company.business_name, 14, 28);
    if (company?.address) doc.text(company.address, 14, 33);

    let y = company?.address ? 42 : company?.business_name ? 37 : 30;

    const info = [
      ["Nome", product.name],
      ["Lotto interno", product.internal_lot],
      ["Data produzione", product.production_date || "—"],
      ["Note", product.notes || "—"],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Campo", "Valore"]],
      body: info,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    if (ingredients.length > 0) {
      doc.setFontSize(13);
      doc.text("Materie prime utilizzate", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Prodotto", "Fornitore", "Lotto int.", "Lotto forn.", "Provenienza", "Scadenza"]],
        body: ingredients.map((m) => [
          m.product_name,
          m.supplier_name || "—",
          m.internal_lot,
          m.supplier_lot || "—",
          m.origin || "—",
          m.expiry_date || "—",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Generato il ${new Date().toLocaleDateString("it-IT")} — Pagina ${i}/${pageCount}`, 14, 290);
    }

    doc.save(`prodotto_${product.internal_lot}.pdf`);
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!product) return <div className="py-12 text-center text-muted-foreground">Prodotto non trovato.</div>;

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/archivio")}>
          <ArrowLeft size={18} />
        </Button>
        <PageHeader title={product.name} subtitle={`Lotto ${product.internal_lot}`} />
      </div>

      <Card className="p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Info label="Data produzione" value={product.production_date} />
          <Info label="Lotto interno" value={product.internal_lot} />
          <Info label="Note" value={product.notes} />
        </div>
        <Button onClick={downloadPdf} className="mt-5 gap-2 bg-gradient-primary">
          <FileDown size={16} /> Scarica PDF
        </Button>
        {labelTemplates.length > 0 && (
          <Button onClick={() => setShowLabelDialog(true)} variant="outline" className="mt-5 ml-2 gap-2">
            <Printer size={16} /> Stampa Etichetta
          </Button>
        )}
      </Card>

      <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stampa Etichetta</DialogTitle>
            <DialogDescription>Seleziona template e quantità, verifica l'anteprima e stampa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Template etichetta</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona template" />
                </SelectTrigger>
                <SelectContent>
                  {labelTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({Number(t.width_mm)}×{Number(t.height_mm)} mm)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Quantità etichette</Label>
              <Input type="number" min={1} max={100} value={labelQty} onChange={(e) => setLabelQty(Math.max(1, +e.target.value))} />
            </div>

            {/* Live preview */}
            {selectedTemplate && (() => {
              const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
              if (!tpl) return null;
              const wMm = Number(tpl.width_mm);
              const hMm = Number(tpl.height_mm);
              const items = computeLabelLayout(wMm, hMm);
              const ptToPx = PX_PER_MM / 2.835;
              return (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Anteprima</Label>
                  <div className="border rounded-lg p-3 bg-muted/30 overflow-auto">
                    <div
                      className="relative bg-white border border-dashed border-border mx-auto"
                      style={{ width: wMm * PX_PER_MM, height: hMm * PX_PER_MM }}
                    >
                      {items.map((it, idx) => (
                        <div
                          key={idx}
                          className="absolute text-black"
                          style={{
                            left: it.x * PX_PER_MM,
                            top: it.y * PX_PER_MM,
                            width: it.w * PX_PER_MM,
                            fontSize: it.fontPt * ptToPx,
                            lineHeight: it.lineHeight,
                            textAlign: it.align,
                            wordBreak: "break-word",
                            overflow: "hidden",
                            fontFamily: "Helvetica, Arial, sans-serif",
                          }}
                        >
                          {it.segments.map((s, i) => (
                            <span key={i} style={{ fontWeight: s.bold ? 700 : 400 }}>{s.text}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {wMm} × {hMm} mm
                  </p>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={printLabel} className="w-full gap-2">
                <Printer size={16} /> Stampa di sistema
              </Button>
              <Button onClick={printLabelBluetooth} disabled={btPrinting} variant="secondary" className="w-full gap-2">
                {btPrinting ? <Loader2 size={16} className="animate-spin" /> : <Bluetooth size={16} />}
                Stampa Etichetta Bluetooth
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Il pulsante Bluetooth invia comandi TSPL alla CLABEL 221D. Richiede Chrome/Edge (desktop o Android).
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <h2 className="font-display font-bold text-lg mb-3">
        Materie prime utilizzate ({ingredients.length})
      </h2>
      {ingredients.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nessuna materia prima collegata.</Card>
      ) : (
        <div className="space-y-2">
          {ingredients.map((m) => (
            <Card
              key={m.id}
              className="p-4 cursor-pointer hover:bg-muted/40 transition"
              onClick={() => navigate(`/archivio/materia-prima/${m.id}`)}
            >
              <div className="font-semibold">{m.product_name}</div>
              <div className="text-xs text-muted-foreground">
                {m.supplier_name || "—"} • <span className="font-mono">{m.internal_lot}</span>
                {m.origin && <> • Origine: {m.origin}</>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}