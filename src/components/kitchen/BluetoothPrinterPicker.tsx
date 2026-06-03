import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bluetooth, Loader2, Printer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  scanForPrinters,
  connectAndSavePrinter,
  type DiscoveredDevice,
  type SavedPrinter,
} from "@/lib/btPrinter";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPicked: (printer: SavedPrinter) => void;
};

export default function BluetoothPrinterPicker({ open, onOpenChange, onPicked }: Props) {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [onlyPrinters, setOnlyPrinters] = useState(true);
  const [stopFn, setStopFn] = useState<null | (() => Promise<void>)>(null);

  async function startScan() {
    setDevices([]);
    setScanning(true);
    try {
      const stop = await scanForPrinters((d) => {
        setDevices((prev) => {
          if (prev.some((x) => x.deviceId === d.deviceId)) return prev;
          // ordina: stampanti probabili prima, poi RSSI migliore (meno negativo)
          const next = [...prev, d].sort((a, b) => {
            if (a.isLikelyPrinter !== b.isLikelyPrinter) return a.isLikelyPrinter ? -1 : 1;
            return (b.rssi ?? -999) - (a.rssi ?? -999);
          });
          return next;
        });
      });
      setStopFn(() => stop);
      // auto-stop dopo 15s per risparmiare batteria
      setTimeout(async () => {
        await stop();
        setScanning(false);
      }, 15000);
    } catch (e: any) {
      console.error("scan error", e);
      toast.error(e?.message || "Impossibile avviare la ricerca Bluetooth. Controlla che il Bluetooth e la posizione siano attivi.");
      setScanning(false);
    }
  }

  async function stopScan() {
    if (stopFn) {
      await stopFn();
      setStopFn(null);
    }
    setScanning(false);
  }

  // avvia automaticamente alla prima apertura
  useEffect(() => {
    if (open) {
      startScan();
    } else {
      stopScan();
    }
    return () => { stopScan(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handlePick(d: DiscoveredDevice) {
    try {
      setConnecting(d.deviceId);
      await stopScan();
      const saved = await connectAndSavePrinter(d.deviceId, d.name);
      toast.success(`Stampante collegata: ${d.name || d.deviceId}`);
      onPicked(saved);
      onOpenChange(false);
    } catch (e: any) {
      console.error("connect error", e);
      toast.error(e?.message || "Connessione fallita");
    } finally {
      setConnecting(null);
    }
  }

  const visible = onlyPrinters ? devices.filter((d) => d.isLikelyPrinter) : devices;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bluetooth size={18} /> Cerca stampante</DialogTitle>
          <DialogDescription>
            Accendi la stampante e attendi che venga rilevata. Tocca il dispositivo per collegarlo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Switch id="only-printers" checked={onlyPrinters} onCheckedChange={setOnlyPrinters} />
            <Label htmlFor="only-printers" className="text-sm">Solo stampanti</Label>
          </div>
          {scanning ? (
            <Button variant="outline" size="sm" onClick={stopScan} className="gap-2">
              <Loader2 size={14} className="animate-spin" /> Scansione…
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={startScan} className="gap-2">
              <Bluetooth size={14} /> Cerca di nuovo
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto rounded border divide-y">
          {visible.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {scanning ? "Ricerca in corso…" : "Nessun dispositivo trovato. Riprova o disattiva il filtro \u201cSolo stampanti\u201d."}
            </div>
          )}
          {visible.map((d) => (
            <button
              key={d.deviceId}
              type="button"
              onClick={() => handlePick(d)}
              disabled={connecting !== null}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent disabled:opacity-50"
            >
              <Printer size={18} className={d.isLikelyPrinter ? "text-primary" : "text-muted-foreground"} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.name || "Dispositivo sconosciuto"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {d.deviceId}{typeof d.rssi === "number" ? ` · ${d.rssi} dBm` : ""}
                </div>
              </div>
              {connecting === d.deviceId && <Loader2 size={16} className="animate-spin" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}