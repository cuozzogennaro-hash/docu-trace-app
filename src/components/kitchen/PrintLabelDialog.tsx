import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Bluetooth } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import {
  isNativeApp,
  buildLabelBytes,
  sendToPrinter,
  getSavedPrinter,
  type SavedPrinter,
} from "@/lib/btPrinter";
import BluetoothPrinterPicker from "./BluetoothPrinterPicker";

export type LabelField = { label: string; value: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  productName: string;
  fields: LabelField[];
  highlight?: string[]; // allergeni in grassetto
};

/**
 * Stampa etichetta semplice per i moduli cucina.
 * NON tocca le logiche delle etichette principali (label_templates / label_rules).
 * Usa window.print con un'area dedicata.
 */
export default function PrintLabelDialog({ open, onOpenChange, title, productName, fields, highlight = [] }: Props) {
  const { company } = useCompany();
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);
  const native = isNativeApp();

  function handlePrint() {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Etichetta</title>
      <style>
        @page { size: 100mm 70mm; margin: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 4mm; color: #000; }
        .lbl { width: 92mm; }
        .lbl h2 { font-size: 11pt; margin: 0 0 1mm 0; font-weight: 700; }
        .lbl h1 { font-size: 14pt; margin: 1mm 0 2mm 0; font-weight: 800; text-transform: uppercase; }
        .lbl .row { font-size: 9pt; margin: 0.5mm 0; }
        .lbl .row b { font-weight: 700; }
        .lbl .lbl-key { color: #555; font-weight: 600; display: inline-block; min-width: 22mm; }
        .lbl .ttl { font-size: 8pt; text-transform: uppercase; letter-spacing: .5px; color: #444; border-bottom: 1px solid #000; padding-bottom: 1mm; margin-bottom: 2mm; }
        .lbl .foot { font-size: 7pt; color: #444; margin-top: 2mm; }
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 250);
  }

  async function handleBluetoothPrint(forcePick = false) {
    const saved = getSavedPrinter();
    if (!saved || forcePick) {
      setPendingPrint(true);
      setPickerOpen(true);
      return;
    }
    await doPrint(saved);
  }

  async function doPrint(printer: SavedPrinter) {
    try {
      setPrinting(true);
      const bytes = buildLabelBytes({
        title,
        businessName: company.business_name || undefined,
        productName,
        fields,
        highlight,
        footer: [company.address, company.city].filter(Boolean).join(" — ") || undefined,
      });
      await sendToPrinter(bytes, printer);
      toast.success("Inviato alla stampante");
    } catch (e: any) {
      toast.error(e?.message || "Errore di stampa Bluetooth");
    } finally {
      setPrinting(false);
    }
  }

  function renderValue(v: string) {
    if (!highlight.length) return v;
    const parts = v.split(new RegExp(`(${highlight.map(escapeRe).join("|")})`, "gi"));
    return parts.map((p, i) =>
      highlight.some((h) => h.toLowerCase() === p.toLowerCase())
        ? <b key={i}>{p}</b>
        : <span key={i}>{p}</span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Anteprima etichetta</DialogTitle></DialogHeader>
        <div ref={printRef} className="border rounded bg-white p-4 text-black">
          <div className="lbl">
            <div className="ttl">{title}</div>
            <h2>{company.business_name || "—"}</h2>
            <h1>{productName}</h1>
            {fields.map((f, i) => (
              <div key={i} className="row">
                <span className="lbl-key">{f.label}:</span> {renderValue(f.value)}
              </div>
            ))}
            {(company.address || company.city) && (
              <div className="foot">{[company.address, company.city].filter(Boolean).join(" — ")}</div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={handlePrint} className="bg-gradient-primary gap-2">
            <Printer size={16} /> Stampa
          </Button>
          {native && (
            <>
              <Button onClick={() => handleBluetoothPrint(false)} disabled={printing} variant="outline" className="gap-2">
                <Bluetooth size={16} /> {printing ? "Invio…" : "Stampa Bluetooth"}
              </Button>
              <Button onClick={() => handleBluetoothPrint(true)} disabled={printing} variant="ghost" size="sm" className="gap-2 text-xs">
                <Bluetooth size={12} /> Cambia stampante…
              </Button>
            </>
          )}
        </div>
      </DialogContent>
      <BluetoothPrinterPicker
        open={pickerOpen}
        onOpenChange={(v) => {
          setPickerOpen(v);
          if (!v) setPendingPrint(false);
        }}
        onPicked={async (printer) => {
          if (pendingPrint) {
            setPendingPrint(false);
            await doPrint(printer);
          }
        }}
      />
    </Dialog>
  );
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}