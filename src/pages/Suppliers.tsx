import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Building2, Loader2, Package, Search } from "lucide-react";
import { toast } from "sonner";

type SupplierAgg = {
  name: string;
  last_date: string | null;
  total: number;
};

type MaterialRow = {
  id: string;
  product_name: string;
  document_date: string | null;
  document_number: string | null;
  supplier_lot: string | null;
  internal_lot: string | null;
  quantity: string | null;
  expiry_date: string | null;
  category: string | null;
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export default function Suppliers() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("nome");

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<SupplierAgg[]>([]);
  const [search, setSearch] = useState("");

  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<MaterialRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("raw_materials")
        .select("supplier_name, document_date, created_at")
        .order("document_date", { ascending: false, nullsFirst: false });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      const map = new Map<string, SupplierAgg>();
      for (const r of data ?? []) {
        const raw = (r as any).supplier_name?.toString().trim();
        if (!raw) continue;
        const key = raw;
        const date = (r as any).document_date ?? null;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { name: raw, last_date: date, total: 1 });
        } else {
          existing.total += 1;
          if (date && (!existing.last_date || date > existing.last_date)) {
            existing.last_date = date;
          }
        }
      }
      const arr = Array.from(map.values()).sort((a, b) => {
        if (!a.last_date && !b.last_date) return a.name.localeCompare(b.name);
        if (!a.last_date) return 1;
        if (!b.last_date) return -1;
        return b.last_date.localeCompare(a.last_date);
      });
      setList(arr);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail([]);
      return;
    }
    (async () => {
      setDetailLoading(true);
      const { data, error } = await supabase
        .from("raw_materials")
        .select(
          "id, product_name, document_date, document_number, supplier_lot, internal_lot, quantity, expiry_date, category",
        )
        .eq("supplier_name", selected)
        .order("document_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) toast.error(error.message);
      setDetail((data ?? []) as MaterialRow[]);
      setDetailLoading(false);
    })();
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.name.toLowerCase().includes(q));
  }, [list, search]);

  if (selected) {
    return (
      <>
        <PageHeader title={selected} subtitle="Storico ingressi merci del fornitore" />
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParams({})}
            className="gap-2"
          >
            <ArrowLeft size={14} /> Torna all'elenco fornitori
          </Button>
        </div>
        <Card className="p-4 shadow-soft">
          {detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="animate-spin" size={14} /> Caricamento…
            </div>
          ) : detail.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-6 text-center">
              Nessun ingresso registrato per questo fornitore.
            </div>
          ) : (
            <div className="space-y-2">
              {detail.map((m) => (
                <Link
                  key={m.id}
                  to={`/archivio/materia-prima/${m.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/40 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[15px] truncate">
                        {m.product_name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        DDT {m.document_number || "—"} · {fmtDate(m.document_date)}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {m.internal_lot && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-mono">
                            {m.internal_lot}
                          </span>
                        )}
                        {m.supplier_lot && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[11px]">
                            Lotto forn. {m.supplier_lot}
                          </span>
                        )}
                        {m.quantity && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[11px]">
                            {m.quantity}
                          </span>
                        )}
                        {m.expiry_date && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px]">
                            Scad. {fmtDate(m.expiry_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Elenco Fornitori"
        subtitle="Generato automaticamente dallo storico Ingresso Merci — pronto per il controllo ASL"
      />
      <Card className="p-4 mb-4 shadow-soft">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Cerca fornitore…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="animate-spin" size={14} /> Caricamento…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="mx-auto mb-3 text-muted-foreground" size={32} />
          <div className="text-sm text-muted-foreground">
            {list.length === 0
              ? "Nessun fornitore presente. Registra un ingresso merci per iniziare a popolare l'elenco."
              : "Nessun fornitore corrisponde alla ricerca."}
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setParams({ nome: s.name })}
              className="w-full text-left"
            >
              <Card className="p-4 hover:shadow-elevated transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Ultimo ingresso: {fmtDate(s.last_date)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold leading-none">{s.total}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end mt-1">
                      <Package size={11} /> ingress{s.total === 1 ? "o" : "i"}
                    </div>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </>
  );
}