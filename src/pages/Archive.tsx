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
import { Pencil, Trash2, Loader2, FileDown, ChevronRight, Search, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useCompany } from "@/hooks/useCompany";
import { useNavigate } from "react-router-dom";
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

/* ---- helpers for monthly grouping & PDF ---- */

function groupByMonth(rows: any[]): Record<string, any[]> {
  const map: Record<string, any[]> = {};
  for (const r of rows) {
    const d = r.event_date ? r.event_date.slice(0, 7) : "senza-data";
    (map[d] ??= []).push(r);
  }
  return map;
}

function monthLabel(ym: string): string {
  if (ym === "senza-data") return "Senza data";
  const [y, m] = ym.split("-");
  const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
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

function generateMonthlyPdf(
  month: string, rows: any[], type: "temperatures" | "sanitations", company: any
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const title = type === "temperatures" ? "Registro Temperature" : "Registro Sanificazioni";
  const sorted = [...rows].sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));
  doc.setFontSize(16);
  doc.text(`${title} — ${monthLabel(month)}`, 14, 20);
  doc.setFontSize(10);
  if (company?.business_name) doc.text(company.business_name, 14, 28);
  if (company?.address) doc.text(company.address, 14, 33);
  const startY = company?.address ? 40 : company?.business_name ? 35 : 28;
  if (type === "temperatures") {
    autoTable(doc, {
      startY,
      head: [["Data", "Attrezzatura", "°C", "Operatore", "Ora", "Note"]],
      body: sorted.map((r) => [
        r.event_date ?? "—", r.asset_name ?? "—", r.temperature ?? "—", r.operator ?? "—",
        r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—",
        r.notes ?? "",
      ]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] },
    });
  } else {
    autoTable(doc, {
      startY,
      head: [["Data", "Attrezzatura", "Operatore", "Prodotto usato", "Ora", "Note"]],
      body: sorted.map((r) => [
        r.event_date ?? "—", r.asset_name ?? "—", r.operator ?? "—", r.product_used ?? "—",
        r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "—",
        r.notes ?? "",
      ]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] },
    });
  }
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Generato il ${new Date().toLocaleDateString("it-IT")} — Pagina ${i}/${pageCount}`, 14, 290);
  }
  doc.save(`${type === "temperatures" ? "temperature" : "sanificazioni"}_${month}.pdf`);
}

function ArchiveTable({ tableKey, company }: { tableKey: TableKey; company: any }) {
  const cfg = CONFIGS[tableKey];
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  function onRowClick(r: any) {
    if (tableKey === "raw_materials") navigate(`/archivio/materia-prima/${r.id}`);
    else if (tableKey === "products") navigate(`/archivio/prodotto/${r.id}`);
  }

  const isClickable = tableKey === "raw_materials" || tableKey === "products";

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

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const lot = (r.internal_lot ?? "").toLowerCase();
      const supplierLot = (r.supplier_lot ?? "").toLowerCase();
      const name = (r.product_name ?? r.name ?? "").toLowerCase();
      return lot.includes(q) || supplierLot.includes(q) || name.includes(q);
    });
  }, [rows, search]);

  const isGroupable = tableKey === "temperatures" || tableKey === "sanitations";
  const grouped = useMemo(() => isGroupable ? groupByMonth(filteredRows) : {}, [filteredRows, isGroupable]);
  const sortedMonths = useMemo(() => Object.keys(grouped).sort((a, b) => b.localeCompare(a)), [grouped]);

  // Weekly grouping for raw materials by document_date
  const weeklyGroups = useMemo(() => {
    if (tableKey !== "raw_materials") return [] as { key: string; label: string; items: any[] }[];
    const startOfWeek = (d: Date) => {
      const x = new Date(d);
      const day = (x.getDay() + 6) % 7;
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() - day);
      return x;
    };
    const map: Record<string, { key: string; start: Date; items: any[] }> = {};
    for (const r of filteredRows) {
      const ref = r.document_date || (r.created_at ? r.created_at.slice(0, 10) : null);
      let key: string;
      let start: Date;
      if (!ref) {
        key = "senza-data";
        start = new Date(0);
      } else {
        const d = new Date(ref + (ref.length === 10 ? "T00:00:00" : ""));
        start = startOfWeek(d);
        key = start.toISOString().slice(0, 10);
      }
      if (!map[key]) map[key] = { key, start, items: [] };
      map[key].items.push(r);
    }
    const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
    return Object.values(map)
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .map((g) => {
        if (g.key === "senza-data") return { key: g.key, label: "Senza data", items: g.items };
        const end = new Date(g.start);
        end.setDate(end.getDate() + 6);
        return { key: g.key, label: `Settimana del ${fmt(g.start)} → ${fmt(end)}`, items: g.items };
      });
  }, [filteredRows, tableKey]);

  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (tableKey === "raw_materials" && weeklyGroups.length > 0) {
      setOpenWeeks((prev) => (prev[weeklyGroups[0].key] === undefined ? { ...prev, [weeklyGroups[0].key]: true } : prev));
    }
  }, [weeklyGroups, tableKey]);

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

  const showSearch = tableKey === "raw_materials" || tableKey === "products";

  const SearchBar = showSearch ? (
    <div className="relative mb-4">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Cerca per lotto interno, lotto fornitore o nome…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-9"
      />
    </div>
  ) : null;

  /* ---- Mobile card renderer ---- */
  function MobileCard({ r }: { r: any }) {
    const primaryCol = cfg.columns[0];
    const secondaryCol = cfg.columns[1];
    return (
      <Card
        className={`p-4 ${isClickable ? "cursor-pointer active:bg-muted/40" : ""}`}
        onClick={() => isClickable && onRowClick(r)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{r[primaryCol.key] ?? "—"}</div>
            {secondaryCol && (
              <div className="text-xs text-muted-foreground truncate">{secondaryCol.label}: {r[secondaryCol.key] ?? "—"}</div>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
              {cfg.columns.slice(2).map((c) => (
                <span key={c.key} className="text-xs text-muted-foreground">
                  <span className="font-medium">{c.label}:</span> {r[c.key] ?? "—"}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
              <Pencil size={14} />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>
              <Trash2 size={14} className="text-destructive" />
            </Button>
            {isClickable && <ChevronRight size={16} className="text-muted-foreground" />}
          </div>
        </div>
      </Card>
    );
  }

  if (isGroupable) {
    return (
      <>
        <div className="space-y-4">
          {sortedMonths.map((month) => (
            <Card key={month} className="overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <h3 className="font-display font-bold text-sm">{monthLabel(month)}</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => generateMonthlyPdf(month, grouped[month], tableKey as "temperatures" | "sanitations", company)}
                >
                  <FileDown size={14} /> PDF
                </Button>
              </div>
              {/* Desktop table */}
              <div className="overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {cfg.columns.map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grouped[month].sort((a: any, b: any) => (a.event_date ?? "").localeCompare(b.event_date ?? "")).map((r: any) => (
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
              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {grouped[month].sort((a: any, b: any) => (a.event_date ?? "").localeCompare(b.event_date ?? "")).map((r: any) => (
                  <div key={r.id} className="p-3">
                    <MobileCard r={r} />
                  </div>
                ))}
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

  if (tableKey === "raw_materials") {
    return (
      <>
        {SearchBar}
        <div className="space-y-3">
          {weeklyGroups.map((g) => (
            <Collapsible
              key={g.key}
              open={openWeeks[g.key] ?? false}
              onOpenChange={(o) => setOpenWeeks((prev) => ({ ...prev, [g.key]: o }))}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 border-b bg-muted/30 hover:bg-muted/50 transition text-left">
                  <h3 className="font-display font-bold text-sm">{g.label} <span className="text-muted-foreground font-normal">({g.items.length})</span></h3>
                  <ChevronDown size={16} className={`text-muted-foreground transition-transform ${openWeeks[g.key] ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {/* Desktop table */}
                  <div className="overflow-x-auto hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {cfg.columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.items.map((r: any) => (
                          <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onRowClick(r)}>
                            {cfg.columns.map((c) => (
                              <TableCell key={c.key} className="text-sm">{r[c.key] ?? "—"}</TableCell>
                            ))}
                            <TableCell className="text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
                                <Pencil size={14} />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(r.id); }}>
                                <Trash2 size={14} className="text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden divide-y">
                    {g.items.map((r: any) => (
                      <div key={r.id} className="p-3"><MobileCard r={r} /></div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
          {weeklyGroups.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground">Nessun risultato.</Card>
          )}
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
                      <Textarea value={editing[c.key] ?? ""} disabled={c.readOnly} onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })} />
                    ) : (
                      <Input type={c.type ?? "text"} value={editing[c.key] ?? ""} disabled={c.readOnly} onChange={(e) => setEditing({ ...editing, [c.key]: e.target.value })} />
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
      {SearchBar}
      {/* Desktop table */}
      <Card className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {cfg.columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={r.id} className={isClickable ? "cursor-pointer hover:bg-muted/40" : ""} onClick={() => isClickable && onRowClick(r)}>
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filteredRows.map((r) => (
          <MobileCard key={r.id} r={r} />
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