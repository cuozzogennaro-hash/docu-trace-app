import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type TableKey = "raw_materials" | "products" | "temperatures" | "sanitations";

type ColumnDef = { key: string; label: string; type?: "text" | "number" | "date" | "textarea"; readOnly?: boolean };

const CONFIGS: Record<TableKey, { label: string; columns: ColumnDef[]; relation?: string }> = {
  raw_materials: {
    label: "Materie Prime",
    columns: [
      { key: "product_name", label: "Prodotto" },
      { key: "supplier_name", label: "Fornitore" },
      { key: "internal_lot", label: "Lotto int.", readOnly: true },
      { key: "supplier_lot", label: "Lotto forn." },
      { key: "quantity", label: "Quantità" },
      { key: "document_date", label: "Data doc.", type: "date" },
      { key: "expiry_date", label: "Scadenza", type: "date" },
    ],
  },
  products: {
    label: "Prodotti",
    columns: [
      { key: "name", label: "Nome" },
      { key: "internal_lot", label: "Lotto", readOnly: true },
      { key: "production_date", label: "Produzione", type: "date" },
      { key: "notes", label: "Note", type: "textarea" },
    ],
  },
  temperatures: {
    label: "Temperature",
    relation: "assets(name)",
    columns: [
      { key: "asset_name", label: "Asset", readOnly: true },
      { key: "temperature", label: "°C", type: "number" },
      { key: "event_date", label: "Data", type: "date" },
      { key: "operator", label: "Operatore" },
      { key: "notes", label: "Note", type: "textarea" },
    ],
  },
  sanitations: {
    label: "Sanificazioni",
    relation: "assets(name)",
    columns: [
      { key: "asset_name", label: "Asset", readOnly: true },
      { key: "event_date", label: "Data", type: "date" },
      { key: "operator", label: "Operatore" },
      { key: "product_used", label: "Prodotto" },
      { key: "notes", label: "Note", type: "textarea" },
    ],
  },
};

export default function Archive() {
  const [tab, setTab] = useState<TableKey>("raw_materials");
  const { company } = useCompany();

  return (
    <>
      <PageHeader title="Archivio" subtitle="Visualizza, modifica e gestisci tutti i tuoi dati HACCP" />
      <Tabs value={tab} onValueChange={(v) => setTab(v as TableKey)}>
        <TabsList className="w-full grid grid-cols-2 lg:grid-cols-4 mb-4 h-auto">
          {(Object.keys(CONFIGS) as TableKey[]).map((k) => (
            <TabsTrigger key={k} value={k} className="py-2">{CONFIGS[k].label}</TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(CONFIGS) as TableKey[]).map((k) => (
          <TabsContent key={k} value={k}>
            <ArchiveTable tableKey={k} company={company} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

/* ---- helpers for daily grouping & PDF ---- */

function groupByDate(rows: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  for (const r of rows) {
    const d = r.event_date ?? "senza-data";
    (map[d] ??= []).push(r);
  }
  return map;
}

function generateDailyPdf(
  date: string,
  rows: any[],
  type: "temperatures" | "sanitations",
  company: any
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = type === "temperatures" ? "Registro Temperature" : "Registro Sanificazioni";

  // Header
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Data: ${date}`, 14, 28);
  if (company?.business_name) doc.text(company.business_name, 14, 34);
  if (company?.address) doc.text(company.address, 14, 39);

  const startY = company?.address ? 46 : company?.business_name ? 41 : 35;

  if (type === "temperatures") {
    autoTable(doc, {
      startY,
      head: [["Attrezzatura", "°C", "Operatore", "Ora", "Note"]],
      body: rows.map((r) => [
        r.asset_name ?? "—",
        r.temperature ?? "—",
        r.operator ?? "—",
        r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—",
        r.notes ?? "",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });
  } else {
    autoTable(doc, {
      startY,
      head: [["Attrezzatura", "Operatore", "Prodotto usato", "Ora", "Note"]],
      body: rows.map((r) => [
        r.asset_name ?? "—",
        r.operator ?? "—",
        r.product_used ?? "—",
        r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—",
        r.notes ?? "",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Generato il ${new Date().toLocaleDateString("it-IT")} — Pagina ${i}/${pageCount}`, 14, 290);
  }

  doc.save(`${type === "temperatures" ? "temperature" : "sanificazioni"}_${date}.pdf`);
}

function ArchiveTable({ tableKey, company }: { tableKey: TableKey; company: any }) {
  const cfg = CONFIGS[tableKey];
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const select = cfg.relation ? `*, ${cfg.relation}` : "*";
    const orderCol = (tableKey === "temperatures" || tableKey === "sanitations") ? "recorded_at" : "created_at";
    const { data, error } = await supabase
      .from(tableKey)
      .select(select)
      .order(orderCol, { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    const flattened = (data ?? []).map((r: any) => ({
      ...r,
      asset_name: r.assets?.name ?? "—",
    }));
    setRows(flattened);
    setLoading(false);
  }

  useEffect(() => { load(); }, [tableKey]);

  const isDailyGroupable = tableKey === "temperatures" || tableKey === "sanitations";
  const grouped = useMemo(() => isDailyGroupable ? groupByDate(rows) : {}, [rows, isDailyGroupable]);
  const sortedDates = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  async function save(updated: any) {
    const payload: any = {};
    cfg.columns.forEach((c) => {
      if (c.readOnly || c.key === "asset_name") return;
      payload[c.key] = updated[c.key] === "" ? null : updated[c.key];
    });
    const { error } = await supabase.from(tableKey).update(payload).eq("id", updated.id);
    if (error) return toast.error(error.message);
    toast.success("Modifiche salvate");
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Eliminare questo record?")) return;
    const { error } = await supabase.from(tableKey).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato");
    load();
  }

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (rows.length === 0) return <Card className="p-12 text-center text-muted-foreground">Nessun record.</Card>;

  if (isDailyGroupable) {
    return (
      <>
        <div className="space-y-4">
          {sortedDates.map((date) => (
            <Card key={date} className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <h3 className="font-display font-bold text-sm">{date}</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => generateDailyPdf(date, grouped[date], tableKey as "temperatures" | "sanitations", company)}
                >
                  <FileDown size={14} /> PDF
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {cfg.columns.filter(c => c.key !== "event_date").map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped[date].map((r: any) => (
                      <TableRow key={r.id}>
                        {cfg.columns.filter(c => c.key !== "event_date").map((c) => (
                          <TableCell key={c.key} className="text-sm">
                            {r[c.key] ?? "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right whitespace-nowrap">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                            <Pencil size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Modifica record</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {cfg.columns.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label>{c.label}</Label>
                    {c.type === "textarea" ? (
                      <Textarea
                        value={editing[c.key] ?? ""}
                        disabled={c.readOnly}
                        onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })}
                      />
                    ) : (
                      <Input
                        type={c.type ?? "text"}
                        value={editing[c.key] ?? ""}
                        disabled={c.readOnly}
                        onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <Button onClick={() => save(editing)} className="w-full bg-gradient-primary">Salva modifiche</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {cfg.columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  {cfg.columns.map((c) => (
                    <TableCell key={c.key} className="text-sm">
                      {r[c.key] ?? "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modifica record</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {cfg.columns.map((c) => (
                <div key={c.key} className="space-y-1.5">
                  <Label>{c.label}</Label>
                  {c.type === "textarea" ? (
                    <Textarea
                      value={editing[c.key] ?? ""}
                      disabled={c.readOnly}
                      onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })}
                    />
                  ) : (
                    <Input
                      type={c.type ?? "text"}
                      value={editing[c.key] ?? ""}
                      disabled={c.readOnly}
                      onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <Button onClick={() => save(editing)} className="w-full bg-gradient-primary">Salva modifiche</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}