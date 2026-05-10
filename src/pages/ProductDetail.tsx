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

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
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
        .select("raw_materials(id, product_name, internal_lot, supplier_name, supplier_lot, origin, quantity, expiry_date, category)")
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
        if (meat) {
          meats.push({ text: `carne di ${meat} (${origin})`, bold: false });
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

  async function printLabel() {
    if (!product) return;
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
    if (!tpl) { toast.error("Seleziona un template"); return; }

    const config = typeof tpl.layout_config === "string" ? JSON.parse(tpl.layout_config) : tpl.layout_config;
    const fields: any[] = config.fields ?? [];
    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);

    const { valueMap, ingredientParts } = getValueMap();

    // Build HTML for one label
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const renderField = (f: any) => {
      if (!f.visible) return "";
      const baseStyle = `position:absolute;left:${f.x}mm;top:${f.y}mm;`;
      if (f.key === "logo") {
        if (!company?.logo_url) return "";
        const w = f.width ?? 25;
        const h = f.height ?? 15;
        return `<img src="${company.logo_url}" style="${baseStyle}width:${w}mm;height:${h}mm;object-fit:contain;" />`;
      }
      const text = valueMap[f.key] ?? "";
      if (!text) return "";
      const fontSize = f.fontSize ?? 10;
      const maxW = wMm - f.x - 2;
      const style = `${baseStyle}max-width:${maxW}mm;font-size:${fontSize}pt;line-height:1.2;font-weight:${f.bold ? 700 : 400};word-break:break-word;`;
      if (f.key === "ingredients" && ingredientParts.length > 0) {
        const parts = ingredientParts
          .map((p, idx) => {
            const sep = idx < ingredientParts.length - 1 ? ", " : "";
            const w = p.bold ? 700 : 400;
            return `<span style="font-weight:${w}">${escapeHtml(p.text)}${sep}</span>`;
          })
          .join("");
        return `<div style="${style}">Ingr.: ${parts}</div>`;
      }
      return `<div style="${style}">${escapeHtml(text)}</div>`;
    };

    const labelHtml = fields.map(renderField).join("");
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
    const config = typeof tpl.layout_config === "string" ? JSON.parse(tpl.layout_config) : tpl.layout_config;
    const fields: any[] = config.fields ?? [];
    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);
    const { valueMap, ingredientParts } = getValueMap();

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

    // Disegno campi
    for (const f of fields) {
      if (!f.visible) continue;
      const x = mmToDots(f.x);
      const y = mmToDots(f.y);

      if (f.key === "logo") {
        if (!company?.logo_url) continue;
        try {
          const img = await loadImage(company.logo_url);
          const w = mmToDots(f.width ?? 25);
          const h = mmToDots(f.height ?? 15);
          // object-fit: contain
          const ratio = Math.min(w / img.width, h / img.height);
          const dw = img.width * ratio;
          const dh = img.height * ratio;
          ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        } catch {
          // ignora errori logo
        }
        continue;
      }

      const text = (valueMap[f.key] ?? "").toString();
      if (!text && !(f.key === "ingredients" && ingredientParts.length > 0)) continue;

      const pt = f.fontSize ?? 10;
      const px = ptToDots(pt);
      const lineHeight = px * 1.2;
      const maxWidth = mmToDots(wMm - f.x - 2);

      if (f.key === "ingredients" && ingredientParts.length > 0) {
        const segs: { text: string; bold: boolean }[] = [{ text: "Ingr.: ", bold: !!f.bold }];
        ingredientParts.forEach((p: any, idx: number) => {
          const sep = idx < ingredientParts.length - 1 ? ", " : "";
          segs.push({ text: p.text + sep, bold: !!p.bold });
        });
        drawWrapped(segs, x, y, maxWidth, lineHeight, px);
      } else {
        drawWrapped([{ text, bold: !!f.bold }], x, y, maxWidth, lineHeight, px);
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
      // Write in chunks (BLE MTU ~ 180-200 bytes)
      const CHUNK = 180;
      for (let i = 0; i < data.length; i += CHUNK) {
        const slice = data.slice(i, i + CHUNK);
        if (ch.properties.writeWithoutResponse) {
          await ch.writeValueWithoutResponse(slice);
        } else {
          await ch.writeValue(slice);
        }
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
              const config = typeof tpl.layout_config === "string" ? JSON.parse(tpl.layout_config) : tpl.layout_config;
              const fields: any[] = config.fields ?? [];
              const wMm = Number(tpl.width_mm);
              const hMm = Number(tpl.height_mm);
              const { valueMap, ingredientParts } = getValueMap();
              const logoUrl = company?.logo_url;
              return (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Anteprima</Label>
                  <div className="border rounded-lg p-3 bg-muted/30 overflow-auto">
                    <div
                      className="relative bg-white border border-dashed border-border mx-auto"
                      style={{ width: wMm * PX_PER_MM, height: hMm * PX_PER_MM }}
                    >
                      {fields.filter((f: any) => f.visible).map((f: any) => {
                        if (f.key === "logo") {
                          return logoUrl ? (
                            <img
                              key={f.key}
                              src={logoUrl}
                              alt="Logo"
                              className="absolute object-contain"
                              style={{
                                left: f.x * PX_PER_MM,
                                top: f.y * PX_PER_MM,
                                width: (f.width ?? 25) * PX_PER_MM,
                                height: (f.height ?? 15) * PX_PER_MM,
                              }}
                            />
                          ) : (
                            <div
                              key={f.key}
                              className="absolute bg-muted/50 border border-dashed border-muted-foreground/30 flex items-center justify-center text-[8px] text-muted-foreground"
                              style={{
                                left: f.x * PX_PER_MM,
                                top: f.y * PX_PER_MM,
                                width: (f.width ?? 25) * PX_PER_MM,
                                height: (f.height ?? 15) * PX_PER_MM,
                              }}
                            >
                              LOGO
                            </div>
                          );
                        }
                        const text = valueMap[f.key] ?? "";
                        const isIngredients = f.key === "ingredients";
                        return (
                          <div key={f.key} className="absolute" style={{ left: f.x * PX_PER_MM, top: f.y * PX_PER_MM, maxWidth: (wMm - f.x - 2) * PX_PER_MM }}>
                            {isIngredients && ingredientParts.length > 0 ? (
                              <span
                                className="text-black block"
                                style={{
                                  fontSize: f.fontSize * (PX_PER_MM / 2.835),
                                  lineHeight: 1.3,
                                  wordBreak: "break-word",
                                }}
                              >
                                Ingr.:{" "}
                                {ingredientParts.map((p, idx) => (
                                  <span key={idx} style={{ fontWeight: p.bold ? 700 : 400 }}>
                                    {p.text}{idx < ingredientParts.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span
                                className="text-black block"
                                style={{
                                  fontSize: f.fontSize * (PX_PER_MM / 2.835),
                                  fontWeight: f.bold ? 700 : 400,
                                  lineHeight: 1.3,
                                  wordBreak: "break-word",
                                }}
                              >
                                {text}
                              </span>
                            )}
                          </div>
                        );
                      })}
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