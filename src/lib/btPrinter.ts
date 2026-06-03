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
 * Funziona solo su app nativa (Capacitor). Su web il pulsante BT è nascosto.
 */

export const isNativeApp = () => Capacitor.isNativePlatform();

// Service/characteristic UUIDs comuni per stampanti termiche BLE ESC/POS.
// Coprono la maggior parte dei chip Bluetooth cinesi (incluse Xprinter XP-P3xx,
// Munbyn, Rongta RPP, HPRT, ecc.).
const KNOWN_WRITE_SERVICES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];
const KNOWN_WRITE_CHARS = [
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000fee8-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
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
];

export function looksLikePrinter(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toUpperCase();
  return PRINTER_NAME_PREFIXES.some((p) => n.includes(p.toUpperCase()));
}

const LS_KEY = "haccp.btprinter";

export type SavedPrinter = {
  deviceId: string;
  name?: string;
  service: string;
  characteristic: string;
};

export function getSavedPrinter(): SavedPrinter | null {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
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

let scanning = false;

/**
 * Avvia uno scan LE aperto (senza filtri sui service UUID, che molte
 * stampanti termiche cinesi non advertisano) e invoca `onDevice` ad ogni
 * nuovo dispositivo rilevato. Restituisce una funzione `stop`.
 */
export async function scanForPrinters(
  onDevice: (d: DiscoveredDevice) => void
): Promise<() => Promise<void>> {
  await BleClient.initialize({ androidNeverForLocation: true });

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
  await BleClient.initialize({ androidNeverForLocation: true });
  // assicurati che lo scan sia fermo prima della connect
  if (scanning) {
    try { await BleClient.stopLEScan(); } catch { /* noop */ }
    scanning = false;
  }
  await BleClient.connect(deviceId, () => { /* on disconnect */ });
  const { service, characteristic } = await findWritableCharacteristic(deviceId);
  const saved: SavedPrinter = { deviceId, name, service, characteristic };
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
  await BleClient.initialize({ androidNeverForLocation: true });
  const device: BleDevice = await BleClient.requestDevice({
    services: KNOWN_WRITE_SERVICES,
    optionalServices: KNOWN_WRITE_SERVICES,
    namePrefix: "",
  });
  await BleClient.connect(device.deviceId, () => { /* on disconnect */ });
  const { service, characteristic } = await findWritableCharacteristic(device.deviceId);
  const saved: SavedPrinter = { deviceId: device.deviceId, name: device.name, service, characteristic };
  saveSavedPrinter(saved);
  return saved;
}

async function ensureConnected(p: SavedPrinter) {
  await BleClient.initialize({ androidNeverForLocation: true });
  try {
    await BleClient.connect(p.deviceId, () => { /* on disconnect */ });
  } catch {
    // già connessa o errore di connessione: riprova una volta
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

// ───────────────────────── Label helper ─────────────────────────

export type PrintLabelInput = {
  title: string;
  businessName?: string;
  productName: string;
  fields: { label: string; value: string }[];
  highlight?: string[];
  footer?: string;
};

export function buildLabelBytes(input: PrintLabelInput): Uint8Array {
  const b = new EscPosBuilder().init();
  b.align("center").size(1, 1).bold(true).line(input.title.toUpperCase()).bold(false);
  if (input.businessName) b.line(input.businessName);
  b.feed(1);
  b.align("left").size(2, 2).bold(true).line(input.productName.toUpperCase()).bold(false).size(1, 1);
  b.feed(1);

  const hl = (input.highlight || []).map((h) => h.toLowerCase());
  for (const f of input.fields) {
    b.bold(true).text(`${f.label}: `).bold(false);
    const isAllergen = hl.length && hl.some((h) => f.value.toLowerCase().includes(h));
    if (isAllergen) b.bold(true).line(f.value).bold(false);
    else b.line(f.value);
  }

  if (input.footer) b.feed(1).align("center").text(input.footer).feed(1);
  b.feed(3).cut();
  return b.build();
}