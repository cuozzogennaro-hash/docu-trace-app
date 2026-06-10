import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Bluetooth, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useLabelTemplates, type LabelTemplate } from "@/hooks/useLabelTemplates";
import {
  buildTSPLBytes,
  canvasToMonoBitmap,
  computeLabelLayout,
  formatDateDDMMYY,
  renderLabelCanvas,
  type LabelData,
} from "@/lib/labelLayout";
import {
  isNativeApp,
  getSavedPrinter,
  saveSavedPrinter,
  sendToPrinter,
  buildPhomemoRaster,
  PHOMEMO_M02_WIDTH_BYTES,
  type SavedPrinter,
} from "@/lib/btPrinter";
import BluetoothPrinterPicker from "@/components/kitchen/BluetoothPrinterPicker";

const PX_PER_MM = 3.78;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: LabelData;
  /** Titolo del dialog (es. "Stampa etichetta mise en place"). */
  title?: string;
  /**
   * Template forniti dal chiamante (override del hook). Utile per percorsi
   * admin-operator senza sessione, dove i template arrivano via RPC.
   */
  templatesOverride?: LabelTemplate[];
  /** Controlli extra renderizzati sopra il selettore template (es. override conservazione). */
  extraControls?: ReactNode;
};

/**
 * Dialog unico di stampa etichette: usa il template grafico configurato
 * dall'editor (Impostazioni → Etichette) e mantiene il supporto Bluetooth
 * (TSPL + Phomemo raster). Sostituisce il vecchio `PrintLabelDialog`.
 */
export default function TemplatedLabelDialog({
  open,
  onOpenChange,
  data,
  title = "Stampa etichetta",
  templatesOverride,
  extraControls,
}: Props) {
  const hook = useLabelTemplates();
  const templates = templatesOverride && templatesOverride.length > 0 ? templatesOverride : hook.templates;
  const defaultTemplate = templatesOverride && templatesOverride.length > 0
    ? (templatesOverride.find((t) => t.is_default) ?? templatesOverride[0] ?? null)
    : hook.defaultTemplate;
  const loading = templatesOverride ? false : hook.loading;
  const [selectedId, setSelectedId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [printing, setPrinting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [savedBt, setSavedBt] = useState<SavedPrinter | null>(() => getSavedPrinter());
  const native = isNativeApp();

  const normalizedData = useMemo<LabelData>(() => {
    const fallbackExpiry = (data as LabelData & { internal_expiry?: string | null; expiry_date?: string | null }).internal_expiry
      || (data as LabelData & { internal_expiry?: string | null; expiry_date?: string | null }).expiry_date;
    const expiryLine = data.expiryLine?.trim()
      ? data.expiryLine.trim()
      : fallbackExpiry
        ? `Da consumarsi entro il: ${formatDateDDMMYY(fallbackExpiry)}`
        : undefined;
    return { ...data, expiryLine };
  }, [data]);

  useEffect(() => {
    if (!open) return;
    const raw = data as LabelData & { internal_expiry?: string | null; expiry_date?: string | null };
    console.info("[Label debug] expiryLine prima di computeLabelLayout", {
      productName: data.productName,
      receivedExpiryLine: data.expiryLine,
      internal_expiry: raw.internal_expiry,
      expiry_date: raw.expiry_date,
      normalizedExpiryLine: normalizedData.expiryLine,
    });
  }, [open, data, normalizedData.expiryLine]);

  const currentId = selectedId || defaultTemplate?.id || "";
  const current: LabelTemplate | null =
    templates.find((t) => t.id === currentId) || defaultTemplate || null;

  const layout = useMemo(() => {
    if (!current) return { items: [], overflow: false, diagnostics: { ingredientsFontPt: 0, contentHeightMm: 0, availableHeightMm: 0 } };
    return computeLabelLayout(normalizedData, current.width_mm, current.height_mm);
  }, [current, normalizedData]);
  const items = layout.items;
  const overflow = layout.overflow;

  async function printWeb() {
    if (!current) { toast.error("Nessun template etichetta configurato"); return; }
    if (overflow) {
      toast.error("Attenzione: Etichetta troppo corta per la quantità di testo. Passare a un formato di etichetta più grande o ridurre gli ingredienti.");
      return;
    }
    const wMm = current.width_mm;
    const hMm = current.height_mm;
    const ptToPx = PX_PER_MM / 2.835;
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const itemsHtml = items.map((it) => {
      const segs = it.segments
        .map((s) => `<span style="font-weight:${s.bold ? 700 : 400}">${escapeHtml(s.text)}</span>`)
        .join("");
      return `<div style="position:absolute;left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;font-size:${it.fontPt}pt;line-height:${it.lineHeight};text-align:${it.align};word-break:break-word;overflow:hidden;">${segs}</div>`;
    }).join("");
    const labelsHtml = Array.from({ length: Math.max(1, qty) })
      .map(() => `<div class="label" style="position:relative;width:${wMm}mm;height:${hMm}mm;overflow:hidden;page-break-after:always;">${itemsHtml}</div>`)
      .join("");
    void ptToPx;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: Helvetica, Arial, sans-serif; color: #000; }
  .label { box-sizing: border-box; }
  @media screen {
    body { padding: 12px; background: #f5f5f5; }
    .label { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin: 0 auto 12px; }
    .actions { position: fixed; top: 8px; right: 8px; z-index: 10; }
    .actions button { padding: 10px 16px; font-size: 14px; border: 0; border-radius: 8px; background: #0a7; color: #fff; }
  }
  @media print { .actions { display: none !important; } body { padding: 0; background: #fff; } .label { box-shadow: none; margin: 0; } }
</style></head>
<body>
<div class="actions"><button onclick="window.print()">Stampa</button></div>
${labelsHtml}
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.open(); win.document.write(html); win.document.close(); }
    else {
      const blob = new Blob([html], { type: "text/html" });
      window.location.href = URL.createObjectURL(blob);
    }
    onOpenChange(false);
  }

  async function doBtPrint(printer: SavedPrinter) {
    if (!current) { toast.error("Nessun template etichetta configurato"); return; }
    if (overflow) {
      toast.error("Attenzione: Etichetta troppo corta per la quantità di testo. Passare a un formato di etichetta più grande o ridurre gli ingredienti.");
      return;
    }
    try {
      setPrinting(true);
      const rotate = !!current.layout_config?.rotate_print;
      let bytes: Uint8Array;
      if (printer.model === "phomemo") {
        const wMmHead = rotate ? current.height_mm : current.width_mm;
        const headWidthDots = PHOMEMO_M02_WIDTH_BYTES * 8;
        const PHOMEMO_DPMM = 8;
        const dpmm = wMmHead > headWidthDots / PHOMEMO_DPMM ? headWidthDots / wMmHead : PHOMEMO_DPMM;
        const { canvas } = renderLabelCanvas(items, current.width_mm, current.height_mm, dpmm, rotate);
        const padded = document.createElement("canvas");
        padded.width = headWidthDots;
        padded.height = canvas.height;
        const pctx = padded.getContext("2d")!;
        pctx.fillStyle = "#fff";
        pctx.fillRect(0, 0, padded.width, padded.height);
        pctx.drawImage(canvas, Math.max(0, Math.floor((headWidthDots - canvas.width) / 2)), 0);
        const { bitmap, widthBytes } = canvasToMonoBitmap(padded, 1);
        bytes = buildPhomemoRaster(bitmap, widthBytes, padded.height, Math.max(1, qty));
      } else {
        bytes = buildTSPLBytes(items, current.width_mm, current.height_mm, rotate, Math.max(1, qty));
      }
      toast.message(`Invio ${bytes.length} byte alla stampante…`);
      await sendToPrinter(bytes, printer);
      toast.success("Etichetta inviata alla stampante");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Errore di stampa Bluetooth");
    } finally {
      setPrinting(false);
    }
  }

  async function handleBluetooth() {
    if (!current) { toast.error("Nessun template etichetta configurato"); return; }
    if (!native) {
      toast.error("Stampa Bluetooth disponibile solo nell'app mobile.");
      return;
    }
    const saved = getSavedPrinter();
    if (!saved) {
      setPendingPrint(true);
      setPickerOpen(true);
      return;
    }
    await doBtPrint(saved);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Usa il template configurato in Impostazioni → Etichette. Verifica l'anteprima e stampa.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : templates.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nessun template etichetta configurato. Crealo in <strong>Impostazioni → Etichette</strong>.
            </div>
          ) : (
            <div className="space-y-4">
              {extraControls}
              {templates.length > 1 && (
                <div>
                  <Label className="text-sm font-medium">Template etichetta</Label>
                  <Select value={currentId} onValueChange={setSelectedId}>
                    <SelectTrigger><SelectValue placeholder="Seleziona template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.width_mm}×{t.height_mm} mm)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">Quantità etichette</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={qty === 0 ? "" : qty}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { setQty(0); return; }
                    const n = parseInt(v, 10);
                    if (!isNaN(n)) setQty(Math.min(100, Math.max(0, n)));
                  }}
                  onBlur={() => { if (!qty || qty < 1) setQty(1); }}
                />
              </div>

              {current && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Anteprima</Label>
                  <div className="border rounded-lg p-3 bg-muted/30 overflow-auto">
                    <div
                      className="relative bg-white border border-dashed border-border mx-auto"
                      style={{ width: current.width_mm * PX_PER_MM, height: current.height_mm * PX_PER_MM }}
                    >
                      {items.map((it, idx) => (
                        <div
                          key={idx}
                          className="absolute text-black"
                          style={{
                            left: it.x * PX_PER_MM,
                            top: it.y * PX_PER_MM,
                            width: it.w * PX_PER_MM,
                            fontSize: it.fontPt * (PX_PER_MM / 2.835),
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
                    {current.width_mm} × {current.height_mm} mm
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {!native && (
                  <Button onClick={printWeb} disabled={overflow} className="w-full gap-2">
                    <Printer size={16} /> Stampa di sistema
                  </Button>
                )}
                <Button
                  onClick={handleBluetooth}
                  disabled={printing || overflow}
                  variant="secondary"
                  className={`w-full gap-2 ${native ? "sm:col-span-2" : ""}`}
                >
                  {printing ? <Loader2 size={16} className="animate-spin" /> : <Bluetooth size={16} />}
                  Stampa Bluetooth
                </Button>
              </div>

              {overflow && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3 text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">Etichetta troppo corta</div>
                    <div className="text-xs opacity-90">
                      Il contenuto non entra nell'etichetta {current?.width_mm}×{current?.height_mm} mm
                      nemmeno al font minimo (4pt). Passare a un formato di etichetta più grande
                      o ridurre gli ingredienti. La stampa è stata bloccata per garantire la conformità.
                    </div>
                  </div>
                </div>
              )}

              {native && (
                <div className="rounded-md border bg-muted/40 p-2 text-xs flex items-center gap-2 flex-wrap">
                  <Bluetooth size={14} className="shrink-0" />
                  {savedBt ? (
                    <>
                      <span className="flex-1 min-w-0 truncate">
                        Stampante associata: <strong>{savedBt.name || savedBt.deviceId}</strong>
                      </span>
                      <Button type="button" size="sm" variant="outline"
                        onClick={() => { setPendingPrint(false); setPickerOpen(true); }}>
                        Cambia
                      </Button>
                      <Button type="button" size="sm" variant="destructive"
                        onClick={() => { saveSavedPrinter(null); setSavedBt(null); toast.success("Stampante disassociata"); }}>
                        Disassocia
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 text-muted-foreground">Nessuna stampante associata.</span>
                      <Button type="button" size="sm" variant="outline"
                        onClick={() => { setPendingPrint(false); setPickerOpen(true); }}>
                        Associa stampante
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BluetoothPrinterPicker
        open={pickerOpen}
        onOpenChange={(v) => { setPickerOpen(v); if (!v) setPendingPrint(false); }}
        onPicked={async (printer) => {
          setSavedBt(printer);
          if (pendingPrint) {
            setPendingPrint(false);
            await doBtPrint(printer);
          }
        }}
      />
    </>
  );
}