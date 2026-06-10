/**
 * Motore di rendering etichette condiviso (pure functions, no React).
 *
 * Replica l'algoritmo visivo usato in `ProductDetail.tsx` ma su un input
 * normalizzato `LabelData`, in modo che ogni chiamante (Archivio prodotti,
 * Cucina, Abbattimenti) produca etichette con lo stesso layout grafico
 * professionale configurato dall'editor template.
 *
 * Layout (su template wMm × hMm):
 *   - Header centrato: nome azienda (auto-fit), indirizzo opzionale
 *   - Titolo centrato: nome prodotto (auto-fit)
 *   - Tracciabilità (opzionale, righe extra prima degli ingredienti)
 *   - Corpo: "Ingr.: <ingredientsText>" (allergeni evidenziati)
 *   - Avviso conservazione (opzionale, sopra il footer)
 *   - Riga allergeni (opzionale, sopra l'avviso)
 *   - Riga scadenza (opzionale, sopra l'avviso/data)
 *   - Footer: "Data Pro.: GG/MM/AA" (sx) + "Lotto: XXX" (dx)
 *
 * Output: array di `LabelItem` rasterizzabili su canvas, da cui derivano
 * sia il bitmap TSPL sia quello Phomemo.
 */

export type LabelData = {
  productName: string;
  companyName?: string;
  companyAddress?: string;
  /** Già formattato "GG/MM/AA" (usa `formatDateDDMMYY`). */
  productionDate?: string;
  /** Lotto interno o stringa libera. */
  internalLot?: string;
  /** Testo libero ingredienti — verrà preceduto da "Ingr.: ". */
  ingredientsText?: string;
  /** Righe extra prima del footer (es. avviso conservazione, note). */
  extraLines?: string[];
  /** "Da consumarsi entro: ..." opzionale (in grassetto, sopra footer). */
  expiryLine?: string;
  /** "Contiene: latte, uova..." opzionale (in grassetto). */
  allergensLine?: string;
  /** Parole da evidenziare in grassetto nel testo ingredienti. */
  highlightAllergens?: string[];
};

export type LabelSeg = { text: string; bold: boolean };
export type LabelItem = {
  x: number; y: number; w: number; // mm
  fontPt: number;
  align: "left" | "center" | "right";
  segments: LabelSeg[];
  lineHeight: number;
};

export type LabelLayout = {
  items: LabelItem[];
  /** True quando, anche al font minimo, il contenuto eccede l'altezza
   *  utile. In tal caso la stampa va bloccata. */
  overflow: boolean;
  /** Diagnostica per messaggi a UI. */
  diagnostics: {
    ingredientsFontPt: number;
    contentHeightMm: number;
    availableHeightMm: number;
  };
};

export function formatDateDDMMYY(s?: string | null): string {
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

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Spezza un testo in segmenti, mettendo in grassetto le parole presenti
 *  nella lista `highlight` (case-insensitive, match parola intera). */
export function splitHighlighted(text: string, highlight: string[]): LabelSeg[] {
  if (!text) return [{ text: "", bold: false }];
  if (!highlight || highlight.length === 0) return [{ text, bold: false }];
  const sorted = [...new Set(highlight.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return [{ text, bold: false }];
  const re = new RegExp(`\\b(${sorted.map(escapeRe).join("|")})\\b`, "gi");
  const out: LabelSeg[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[0], bold: true });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out.length ? out : [{ text, bold: false }];
}

/**
 * Calcola il layout dei `LabelItem` per un'etichetta `wMm × hMm` a partire
 * dai dati semantici. L'algoritmo è identico a quello di ProductDetail per
 * i campi comuni, in modo che il risultato visivo sia uniforme.
 */
export function computeLabelLayout(data: LabelData, wMm: number, hMm: number): LabelLayout {
  const p = Math.max(1.2, Math.min(wMm, hMm) * 0.04);
  const safetyR = Math.max(3, wMm * 0.04);

  const titlePtBase = Math.max(10, Math.round(hMm * 0.34));
  const companyPtBase = Math.max(9, Math.round(hMm * 0.28));
  const ingrPtBase = Math.max(6, Math.round(hMm * 0.15));
  const addressPt = Math.max(5, Math.round(hMm * 0.11));
  const footerPtBase = Math.max(7, Math.round(hMm * 0.22));
  const lh = 1.2;
  const ptMm = (pt: number) => pt * 0.3528;

  // Misuratore canvas off-screen per auto-fit dei titoli su una singola riga
  const measureCanvas = typeof document !== "undefined"
    ? document.createElement("canvas")
    : null;
  const measureCtx = measureCanvas?.getContext("2d") ?? null;
  const measureWidthMm = (text: string, pt: number, bold: boolean): number => {
    if (!measureCtx) return text.length * pt * 0.18; // rough fallback (SSR)
    const px = pt * 4;
    measureCtx.font = `${bold ? "bold " : ""}${px}px Helvetica, Arial, sans-serif`;
    const wPx = measureCtx.measureText(text).width;
    return (wPx / (pt * 4)) * pt * 0.3528;
  };
  const fitPt = (text: string, maxMm: number, startPt: number, minPt: number, bold: boolean) => {
    let pt = startPt;
    while (pt > minPt && measureWidthMm(text, pt, bold) > maxMm) pt -= 0.5;
    return Math.max(minPt, pt);
  };

  /** Conta quante righe occuperà un blocco di segmenti renderizzato con
   *  `drawWrapped` (token-by-token, wrap su parola). */
  const measureWrappedLines = (segments: LabelSeg[], maxMm: number, pt: number): number => {
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
    if (tokens.length === 0) return 0;
    const spaceW = measureWidthMm(" ", pt, false);
    let lines = 1;
    let x = 0;
    for (const tok of tokens) {
      const w = measureWidthMm(tok.word, pt, tok.bold);
      if (x + w > maxMm && x > 0) {
        lines += 1;
        x = 0;
      }
      x += w;
      if (tok.trailingSpace) x += spaceW;
    }
    return lines;
  };

  const titleMaxMm = wMm - 2 * p - safetyR;
  const titleCompanyPt = fitPt(data.companyName || " ", titleMaxMm, companyPtBase, 8, true);
  const titleProductPt = fitPt(data.productName || " ", titleMaxMm, titlePtBase, 8, true);
  const productPt = titleProductPt;
  const companyPt = Math.min(titleCompanyPt, companyPtBase);

  const footerLeftW = (wMm - 2 * p - safetyR) / 2 - 0.5;
  const footerRightW = (wMm - 2 * p - safetyR) / 2 - 0.5;
  const dataText = `Data Pro.: ${data.productionDate || "—"}`;
  const lotText = `Lotto: ${data.internalLot || "—"}`;
  const footerPt = Math.min(
    fitPt(dataText, footerLeftW, footerPtBase, 6, false),
    fitPt(lotText, footerRightW, footerPtBase, 6, true),
  );
  const footerH = ptMm(footerPt) * lh;
  const footerY = hMm - p - footerH;
  const innerW = wMm - 2 * p - safetyR;
  const GAP = 0.5; // mm di padding di sicurezza tra blocchi
  const MIN_INGR_PT = 4;

  // ---- Header items (società/indirizzo/titolo) calcolati una volta sola ----
  const headerItems: LabelItem[] = [];
  let yHeader = p;

  if (data.companyName) {
    headerItems.push({
      x: p, y: yHeader, w: innerW,
      fontPt: companyPt, align: "center", lineHeight: lh,
      segments: [{ text: data.companyName, bold: true }],
    });
    yHeader += ptMm(companyPt) * lh + GAP;
  }
  if (data.companyAddress) {
    const addrLines = Math.max(1, Math.min(2, Math.ceil(measureWidthMm(data.companyAddress, addressPt, false) / innerW)));
    headerItems.push({
      x: p, y: yHeader, w: innerW,
      fontPt: addressPt, align: "center", lineHeight: lh,
      segments: [{ text: data.companyAddress, bold: false }],
    });
    yHeader += ptMm(addressPt) * lh * addrLines + 0.4;
  }
  headerItems.push({
    x: p, y: yHeader, w: innerW,
    fontPt: productPt, align: "center", lineHeight: lh,
    segments: [{ text: data.productName || "—", bold: true }],
  });
  yHeader += ptMm(productPt) * lh + 0.6;

  // ---- Shrink-to-fit verticale sul blocco ingredienti ----
  const ingredientsSegments: LabelSeg[] | null = data.ingredientsText
    ? (() => {
        const segs: LabelSeg[] = [{ text: "Ingr.: ", bold: true }];
        splitHighlighted(data.ingredientsText, data.highlightAllergens || []).forEach((s) => segs.push(s));
        return segs;
      })()
    : null;

  type Attempt = {
    items: LabelItem[];
    bottomY: number;
    ingrPt: number;
  };

  // ---- Scadenza ancorata in basso (sempre visibile sopra il footer) ----
  // Calcolata PRIMA del flow ingredienti per definire il limite verticale
  // entro cui il blocco ingredienti/extras/allergeni può espandersi.
  const expiryItem: LabelItem | null = data.expiryLine
    ? (() => {
        const expiryPt = fitPt(data.expiryLine, innerW, footerPt, 6, true);
        return {
          x: p, y: 0, w: innerW,
          fontPt: expiryPt, align: "right" as const, lineHeight: lh,
          segments: [{ text: data.expiryLine, bold: true }],
        };
      })()
    : null;
  const expiryH = expiryItem ? ptMm(expiryItem.fontPt) * lh : 0;
  const expiryY = expiryItem ? footerY - GAP - expiryH : footerY;
  if (expiryItem) expiryItem.y = expiryY;
  // Limite inferiore per il blocco ingredienti/extras/allergeni
  const contentLimitY = (expiryItem ? expiryY : footerY) - GAP;

  const buildAttempt = (ingrPt: number): Attempt => {
    const items: LabelItem[] = headerItems.map((it) => ({ ...it }));
    let y = yHeader;

    if (ingredientsSegments) {
      const lines = measureWrappedLines(ingredientsSegments, innerW, ingrPt);
      const h = ptMm(ingrPt) * lh * lines;
      items.push({
        x: p, y, w: innerW,
        fontPt: ingrPt, align: "left", lineHeight: lh,
        segments: ingredientsSegments,
      });
      y += h + GAP;
    }

    // Righe extra (push-down sequenziale)
    const extraBasePt = Math.max(5, footerPt * 0.85);
    (data.extraLines || []).forEach((line) => {
      const linePt = fitPt(line, innerW, extraBasePt, 4, false);
      const lines = measureWrappedLines([{ text: line, bold: false }], innerW, linePt);
      items.push({
        x: p, y, w: innerW,
        fontPt: linePt, align: "left", lineHeight: lh,
        segments: [{ text: line, bold: false }],
      });
      y += ptMm(linePt) * lh * lines + GAP;
    });

    if (data.allergensLine) {
      const allergPt = fitPt(data.allergensLine, innerW, Math.max(5, footerPt * 0.85), 4, true);
      const lines = measureWrappedLines([{ text: data.allergensLine, bold: true }], innerW, allergPt);
      items.push({
        x: p, y, w: innerW,
        fontPt: allergPt, align: "left", lineHeight: lh,
        segments: [{ text: data.allergensLine, bold: true }],
      });
      y += ptMm(allergPt) * lh * lines + GAP;
    }

    return { items, bottomY: y, ingrPt };
  };

  // Itera riducendo ingrPt di 0.5 finché entra o si raggiunge il minimo
  let chosen: Attempt = buildAttempt(ingrPtBase);
  if (ingredientsSegments) {
    let pt = ingrPtBase;
    while (chosen.bottomY > contentLimitY && pt > MIN_INGR_PT) {
      pt = Math.max(MIN_INGR_PT, pt - 0.5);
      chosen = buildAttempt(pt);
    }
  }

  const overflow = chosen.bottomY > contentLimitY;

  // Scadenza (ancorata sopra il footer, sempre visibile)
  if (expiryItem) chosen.items.push(expiryItem);

  // Footer (sempre presente, ancorato in basso)
  chosen.items.push({
    x: p, y: footerY, w: footerLeftW,
    fontPt: footerPt, align: "left", lineHeight: lh,
    segments: [{ text: dataText, bold: false }],
  });
  chosen.items.push({
    x: wMm - p - safetyR - footerRightW, y: footerY, w: footerRightW,
    fontPt: footerPt, align: "right", lineHeight: lh,
    segments: [{ text: lotText, bold: true }],
  });

  return {
    items: chosen.items,
    overflow,
    diagnostics: {
      ingredientsFontPt: chosen.ingrPt,
      contentHeightMm: chosen.bottomY - p,
      availableHeightMm: contentLimitY - p,
    },
  };
}


/**
 * Renderizza gli `items` su un canvas monocromatico alla risoluzione passata
 * (in dot/mm). Se `rotate` è true, l'output finale viene ruotato 90°
 * (per template disegnati in orizzontale e stampati in verticale).
 */
export function renderLabelCanvas(
  items: LabelItem[],
  wMm: number,
  hMm: number,
  dpmm: number,
  rotate: boolean,
): { canvas: HTMLCanvasElement; widthDots: number; heightDots: number; wMm: number; hMm: number } {
  const widthDots = Math.round(wMm * dpmm);
  const heightDots = Math.round(hMm * dpmm);
  const ptToDots = (pt: number) => pt * (dpmm * 25.4 / 72);
  const mmToDots = (mm: number) => mm * dpmm;

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

  const drawWrapped = (
    segments: LabelSeg[],
    xStart: number,
    yStart: number,
    maxWidth: number,
    lineHeight: number,
    px: number,
  ) => {
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
    setFont(px, false);
    const spaceW = ctx.measureText(" ").width;
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
  };

  for (const it of items) {
    const x = mmToDots(it.x);
    const y = mmToDots(it.y);
    const px = ptToDots(it.fontPt);
    const lineHeight = px * it.lineHeight;
    const maxWidth = mmToDots(it.w);
    if (it.align === "left") {
      drawWrapped(it.segments, x, y, maxWidth, lineHeight, px);
    } else {
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

  if (rotate) {
    const rotated = document.createElement("canvas");
    rotated.width = heightDots;
    rotated.height = widthDots;
    const rctx = rotated.getContext("2d", { willReadFrequently: true })!;
    rctx.fillStyle = "#ffffff";
    rctx.fillRect(0, 0, rotated.width, rotated.height);
    rctx.translate(rotated.width, 0);
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(canvas, 0, 0);
    return { canvas: rotated, widthDots: rotated.width, heightDots: rotated.height, wMm: hMm, hMm: wMm };
  }
  return { canvas, widthDots, heightDots, wMm, hMm };
}

/** Converte un canvas in bitmap 1bpp MSB-first.
 *  blackBit=0 → TSPL (bit 0 = nero), blackBit=1 → Phomemo (bit 1 = nero). */
export function canvasToMonoBitmap(canvas: HTMLCanvasElement, blackBit: 0 | 1): { bitmap: Uint8Array; widthBytes: number } {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const widthDots = canvas.width;
  const heightDots = canvas.height;
  const imgData = ctx.getImageData(0, 0, widthDots, heightDots);
  const widthBytes = Math.ceil(widthDots / 8);
  const bitmap = new Uint8Array(widthBytes * heightDots);
  bitmap.fill(blackBit === 0 ? 0xff : 0x00);
  for (let py = 0; py < heightDots; py++) {
    for (let px = 0; px < widthDots; px++) {
      const i = (py * widthDots + px) * 4;
      const r = imgData.data[i];
      const g = imgData.data[i + 1];
      const b = imgData.data[i + 2];
      const a = imgData.data[i + 3];
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) * (a / 255) + 255 * (1 - a / 255);
      if (lum < 160) {
        const byteIdx = py * widthBytes + (px >> 3);
        const bit = 7 - (px & 7);
        if (blackBit === 0) bitmap[byteIdx] &= ~(1 << bit);
        else bitmap[byteIdx] |= (1 << bit);
      }
    }
  }
  return { bitmap, widthBytes };
}

/** Costruisce il comando TSPL per una stampante termica generica
 *  (CLABEL CT221D, Xprinter, ecc.). */
export function buildTSPLBytes(
  items: LabelItem[],
  templateWidthMm: number,
  templateHeightMm: number,
  rotate: boolean,
  copies: number,
): Uint8Array {
  const { canvas, heightDots, wMm, hMm } = renderLabelCanvas(items, templateWidthMm, templateHeightMm, 8, rotate);
  const { bitmap, widthBytes } = canvasToMonoBitmap(canvas, 0);
  const enc = new TextEncoder();
  const header = enc.encode(
    [
      `SIZE ${wMm} mm,${hMm} mm`,
      `GAP 2 mm,0 mm`,
      `DIRECTION 1`,
      `CLS`,
      `BITMAP 0,0,${widthBytes},${heightDots},0,`,
    ].join("\r\n"),
  );
  const footer = enc.encode(`\r\nPRINT ${Math.max(1, copies)},1\r\n`);
  const total = new Uint8Array(header.length + bitmap.length + footer.length);
  total.set(header, 0);
  total.set(bitmap, header.length);
  total.set(footer, header.length + bitmap.length);
  return total;
}