import { Capacitor } from "@capacitor/core";
import {
  BleClient,
  numbersToDataView,
  type BleDevice,
  type ScanResult,
} from "@capacitor-community/bluetooth-le";

/**
 * ESC/POS Bluetooth printer helper for thermal label/receipt printers
 * (Xprinter, Munbyn, Rongta, HPRT, ecc.).
 *
 * Funziona sia in app nativa sia da browser compatibili con Web Bluetooth.
 */

export const isNativeApp = () => Capacitor.isNativePlatform();

// Service/characteristic UUIDs comuni per stampanti termiche BLE ESC/POS.
// Coprono la maggior parte dei chip Bluetooth cinesi (incluse Xprinter XP-P3xx,
// Munbyn, Rongta RPP, HPRT, ecc.).
const KNOWN_WRITE_SERVICES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000af30-0000-1000-8000-00805f9b34fb", // Phomemo M02 Service
];
const KNOWN_WRITE_CHARS = [
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000fee8-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
  "0000af31-0000-1000-8000-00805f9b34fb", // Phomemo M02 Write Characteristic
  "0000e708-0000-1000-8000-00805f9b34fb", // Alternativa per alcuni firmware
];

// Prefissi nome più comuni per stampanti termiche BLE ESC/POS.
// Usato dal picker custom per filtrare la lista (l'utente può sempre
// disattivare il filtro per vedere tutti i device).
export const PRINTER_NAME_PREFIXES = [
  "XP-",        // Xprinter
  "MTP-",       // Munbyn / generic
  "MPT-",
  "RPP",        // Rongta
  "MUNBYN",
  "GP-",        // Gainscha
  "HM-",        // HOIN
  "HPRT",
  "POS",
  "PT-",
  "PRT-",
  "PRINTER",
  "BT-",
  "BLE-",
  "BT_SPP",
  "ESC-POS",
  "Thermal",
  // Phomemo (M02/M02S/M03/M04/M110/M120/M220 ecc.)
  "PHOMEMO",
  "M02",
  "M03",
  "M04",
  "M110",
  "M120",
  "M220",
  "T02",
  // CLABEL / Niimbot (cloni raster simil-Phomemo)
  "CLABEL",
  "C-LABEL",
  "NIIMBOT",
];

export function looksLikePrinter(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toUpperCase();
  return PRINTER_NAME_PREFIXES.some((p) => n.includes(p.toUpperCase()));
}

/**
 * Famiglia di protocollo della stampante.
 * - escpos: raster standard, scelta più sicura per Bluetooth perché evita che
 *   comandi testuali come SIZE/GAP vengano stampati letteralmente.
 * - tspl: solo stampanti label che interpretano esplicitamente TSPL.
 * - phomemo: raster ESC/POS con inizializzazione proprietaria Phomemo.
 */
export type PrinterModel = "escpos" | "tspl" | "phomemo";

const PHOMEMO_HINTS = ["PHOMEMO", "M02", "M03", "M04", "T02"];
const TSPL_HINTS = ["XPRINTER", "XP-", "TSC", "TTP", "TDP", "GODEX"];

export function detectPrinterModel(name?: string | null): PrinterModel {
  if (!name) return "escpos";
  const n = name.toUpperCase();
  if (PHOMEMO_HINTS.some((p) => n.includes(p))) return "phomemo";
  // CLABEL / C-LABEL / NIIMBOT (e cloni) usano un protocollo raster
  // ESC/POS: non comprendono TSPL (stamperebbero i comandi
  // "SIZE / GAP / DIRECTION..." come testo). Li instradiamo sulla
  // pipeline raster monocromatica.
  if (n.includes("CLABEL") || n.includes("C-LABEL") || n.includes("NIIMBOT")) {
    return "escpos";
  }
  if (TSPL_HINTS.some((p) => n.includes(p))) return "tspl";
  return "escpos";
}

const LS_KEY = "haccp.btprinter";

export type SavedPrinter = {
  deviceId: string;
  name?: string;
  service: string;
  characteristic: string;
  /** Famiglia protocollo. Default "escpos" per evitare stampa di comandi TSPL come testo. */
  model?: PrinterModel;
  /** True se l'operatore ha scelto manualmente il protocollo dal dialog. */
  protocolManual?: boolean;
};

export function getSavedPrinter(): SavedPrinter | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null") as SavedPrinter | null;
    if (!raw) return null;
    // Ri-valuta il protocollo solo se non è stato impostato manualmente.
    // Le vecchie associazioni salvate come "tspl" senza scelta esplicita
    // vengono migrate a raster quando il nome non indica una TSPL reale:
    // è esattamente il caso in cui la stampante stampa "SIZE/GAP" su carta.
    const detected = detectPrinterModel(raw.name);
    if (!raw.protocolManual && raw.model !== detected) {
      raw.model = detected;
      try { localStorage.setItem(LS_KEY, JSON.stringify(raw)); } catch { /* noop */ }
    } else if (!raw.model) {
      raw.model = detected;
    }
    return raw;
  } catch { return null; }
}
export function saveSavedPrinter(p: SavedPrinter | null) {
  if (p) localStorage.setItem(LS_KEY, JSON.stringify(p));
  else localStorage.removeItem(LS_KEY);
}

// ───────────────────────── Scan ─────────────────────────

export type DiscoveredDevice = {
  deviceId: string;
  name?: string;
  rssi?: number;
  isLikelyPrinter: boolean;
};

let bleInitialized = false;
async function ensureBleInitialized() {
  if (bleInitialized) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  bleInitialized = true;
}

let scanning = false;

/**
 * Avvia uno scan LE aperto (senza filtri sui service UUID, che molte
 * stampanti termiche cinesi non advertisano) e invoca `onDevice` ad ogni
 * nuovo dispositivo rilevato. Restituisce una funzione `stop`.
 */
export async function scanForPrinters(
  onDevice: (d: DiscoveredDevice) => void
): Promise<() => Promise<void>> {
  await ensureBleInitialized();

  const seen = new Map<string, DiscoveredDevice>();

  if (scanning) {
    try { await BleClient.stopLEScan(); } catch { /* noop */ }
    scanning = false;
  }

  await BleClient.requestLEScan(
    { allowDuplicates: false },
    (result: ScanResult) => {
      const id = result.device.deviceId;
      if (!id) return;
      const name = result.device.name || result.localName || undefined;
      const dev: DiscoveredDevice = {
        deviceId: id,
        name,
        rssi: result.rssi ?? undefined,
        isLikelyPrinter: looksLikePrinter(name),
      };
      const prev = seen.get(id);
      if (!prev || (dev.name && !prev.name)) {
        seen.set(id, dev);
        onDevice(dev);
      }
    }
  );
  scanning = true;

  return async () => {
    if (!scanning) return;
    try { await BleClient.stopLEScan(); } catch { /* noop */ }
    scanning = false;
  };
}

/**
 * Si connette al device scelto dall'utente e salva la stampante.
 */
export async function connectAndSavePrinter(deviceId: string, name?: string): Promise<SavedPrinter> {
  await ensureBleInitialized();
  // assicurati che lo scan sia fermo prima della connect
  if (scanning) {
    try { await BleClient.stopLEScan(); } catch { /* noop */ }
    scanning = false;
  }
  
  // Forza disconnessione precedente e attende 500ms per resettare l'hardware Bluetooth
  try { await BleClient.disconnect(deviceId); } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));

  await BleClient.connect(deviceId, () => { /* on disconnect */ });
  const { service, characteristic } = await findWritableCharacteristic(deviceId);
  const saved: SavedPrinter = {
    deviceId,
    name,
    service,
    characteristic,
    model: detectPrinterModel(name),
  };
  saveSavedPrinter(saved);
  return saved;
}

// ───────────────────────── ESC/POS encoder ─────────────────────────

const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private parts: number[] = [];

  init() { this.parts.push(ESC, 0x40); return this; }
  bold(on: boolean) { this.parts.push(ESC, 0x45, on ? 1 : 0); return this; }
  align(a: "left" | "center" | "right") {
    this.parts.push(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2);
    return this;
  }
  size(width: 1 | 2, height: 1 | 2) {
    const n = ((width - 1) << 4) | (height - 1);
    this.parts.push(GS, 0x21, n);
    return this;
  }
  underline(on: boolean) { this.parts.push(ESC, 0x2d, on ? 1 : 0); return this; }
  feed(lines = 1) { for (let i = 0; i < lines; i++) this.parts.push(0x0a); return this; }
  cut() { this.parts.push(GS, 0x56, 0x00); return this; }

  text(s: string) {
    // CP437/Latin-1 fallback: encode as Latin-1 so accenti italiani escano corretti.
    const enc = new TextEncoder(); // UTF-8; va bene per accenti su molte stampanti moderne
    const bytes = Array.from(enc.encode(s));
    this.parts.push(...bytes);
    return this;
  }
  line(s = "") { this.text(s).feed(1); return this; }

  build(): Uint8Array { return new Uint8Array(this.parts); }
}

// ───────────────────────── BLE plumbing ─────────────────────────

async function findWritableCharacteristic(deviceId: string) {
  const services = await BleClient.getServices(deviceId);
  for (const s of services) {
    if (KNOWN_WRITE_SERVICES.includes(s.uuid.toLowerCase())) {
      for (const c of s.characteristics) {
        if (KNOWN_WRITE_CHARS.includes(c.uuid.toLowerCase())) {
          return { service: s.uuid, characteristic: c.uuid };
        }
      }
    }
  }
  // fallback: prima caratteristica con write
  for (const s of services) {
    for (const c of s.characteristics) {
      if (c.properties?.write || c.properties?.writeWithoutResponse) {
        return { service: s.uuid, characteristic: c.uuid };
      }
    }
  }
  throw new Error("Nessuna caratteristica di scrittura trovata sulla stampante");
}

export async function pickAndConnectPrinter(): Promise<SavedPrinter> {
  await ensureBleInitialized();
  const device: BleDevice = await BleClient.requestDevice({
    // Su web molte stampanti non pubblicizzano i service nell'advertising:
    // filtrare per UUID le nasconde dal popup. Lasciamo quindi la scelta aperta
    // e chiediamo l'accesso ai service noti per poter scrivere dopo il pairing.
    optionalServices: KNOWN_WRITE_SERVICES,
  });

  // Forza disconnessione precedente e attende 500ms per resettare l'hardware Bluetooth
  try { await BleClient.disconnect(device.deviceId); } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));

  await BleClient.connect(device.deviceId, () => { /* on disconnect */ });
  const { service, characteristic } = await findWritableCharacteristic(device.deviceId);
  const saved: SavedPrinter = {
    deviceId: device.deviceId,
    name: device.name,
    service,
    characteristic,
    model: detectPrinterModel(device.name),
  };
  saveSavedPrinter(saved);
  return saved;
}

async function ensureConnected(p: SavedPrinter) {
  await ensureBleInitialized();
  try {
    // Forza disconnessione precedente e attende prima della riconnessione
    try { await BleClient.disconnect(p.deviceId); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
    await BleClient.connect(p.deviceId, () => { /* on disconnect */ });
  } catch {
    // riprova una volta pulendo la sessione
    try { await BleClient.disconnect(p.deviceId); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
    await BleClient.connect(p.deviceId);
  }
}

export async function sendToPrinter(data: Uint8Array, printer?: SavedPrinter) {
  const p = printer ?? getSavedPrinter() ?? (await pickAndConnectPrinter());
  await ensureConnected(p);
  // chunk a 180 byte per evitare MTU issues
  const chunk = 180;
  for (let i = 0; i < data.length; i += chunk) {
    const slice = data.slice(i, i + chunk);
    await BleClient.writeWithoutResponse(
      p.deviceId,
      p.service,
      p.characteristic,
      numbersToDataView(Array.from(slice))
    );
  }
}

// ───────────────────────── Phomemo M-series raster ─────────────────────────

/**
 * Larghezza in dot della famiglia Phomemo M02/M02S/M03 (rotolo continuo 53mm,
 * area stampabile 48mm @ 203dpi = 384 dot = 48 byte per riga).
 * Per le M110/M220 con etichette gommate si usa lo stesso protocollo ma con
 * 96 byte/riga: questa funzione si tara sul valore passato in widthBytes.
 */
export const PHOMEMO_M02_WIDTH_BYTES = 48;

/**
 * Costruisce i bytes per stampare un bitmap monocromatico su una stampante
 * Phomemo M-series (M02/M02S/M03/M04/T02). Il bitmap deve essere già
 * impacchettato 1 bit per pixel, MSB-first, con i bit a 1 = pixel NERO
 * (l'opposto della convenzione TSPL: la M02 stampa i bit attivi).
 */
export function buildPhomemoRaster(
  bitmap: Uint8Array,
  widthBytes: number,
  heightDots: number,
  copies: number = 1,
): Uint8Array {
  const start = [
    0x1b, 0x40,             // ESC @  init
    0x1f, 0x11, 0x02, 0x04, // phomemo: set energy / mode
  ];
  const end = [
    0x1b, 0x64, 0x02,
    0x1b, 0x64, 0x02,
    0x1f, 0x11, 0x08,
    0x1f, 0x11, 0x0e,
    0x1f, 0x11, 0x07,
    0x1f, 0x11, 0x09,
  ];

  // Si invia in blocchi di max 255 righe per rispettare il limite a 16 bit
  // del comando raster GS v 0 (rimaniamo conservativi e usiamo 256).
  const ROWS_PER_CHUNK = 256;

  const chunks: number[][] = [];
  chunks.push(start);

  for (let copy = 0; copy < Math.max(1, copies); copy++) {
    for (let y = 0; y < heightDots; y += ROWS_PER_CHUNK) {
      const rows = Math.min(ROWS_PER_CHUNK, heightDots - y);
      const header = [
        0x1d, 0x76, 0x30, 0x00,
        widthBytes & 0xff, (widthBytes >> 8) & 0xff,
        rows & 0xff, (rows >> 8) & 0xff,
      ];
      chunks.push(header);
      // slice direttamente dal bitmap monocromatico
      const offset = y * widthBytes;
      const sliceLen = rows * widthBytes;
      chunks.push(Array.from(bitmap.subarray(offset, offset + sliceLen)));
    }
    // piccolo feed tra una copia e l'altra
    if (copy < copies - 1) chunks.push([0x1b, 0x64, 0x02]);
  }

  chunks.push(end);

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/**
 * Raster ESC/POS standard (GS v 0). È la modalità più compatibile per molte
 * stampanti Bluetooth che accettano immagini ma NON interpretano TSPL: in quel
 * caso inviare TSPL produce la stampa letterale di "SIZE", "GAP", "BITMAP".
 */
export function buildEscPosRaster(
  bitmap: Uint8Array,
  widthBytes: number,
  heightDots: number,
  copies: number = 1,
): Uint8Array {
  const start = [
    0x1b, 0x40,       // ESC @ init
    0x1b, 0x33, 0x00, // nessun avanzamento extra tra righe raster
  ];
  const end = [
    0x1b, 0x32,       // ripristina line spacing default
  ];
  const ROWS_PER_CHUNK = 256;
  const chunks: number[][] = [start];

  for (let copy = 0; copy < Math.max(1, copies); copy++) {
    for (let y = 0; y < heightDots; y += ROWS_PER_CHUNK) {
      const rows = Math.min(ROWS_PER_CHUNK, heightDots - y);
      chunks.push([
        0x1d, 0x76, 0x30, 0x00,
        widthBytes & 0xff, (widthBytes >> 8) & 0xff,
        rows & 0xff, (rows >> 8) & 0xff,
      ]);
      const offset = y * widthBytes;
      chunks.push(Array.from(bitmap.subarray(offset, offset + rows * widthBytes)));
    }
    // FF chiede alle label printer ESC/POS compatibili di avanzare al gap/inizio
    // etichetta successiva. Evita i vecchi LF arbitrari, che su formati 40×70
    // potevano far slittare la stampa sulla seconda etichetta.
    chunks.push([0x0c]);
  }

  chunks.push(end);
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}