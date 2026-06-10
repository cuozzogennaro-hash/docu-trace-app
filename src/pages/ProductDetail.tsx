import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileDown, Loader2, Printer, Trash2, FileText } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";
import { useLabelRules } from "@/hooks/useLabelRules";
import TemplatedLabelDialog from "@/components/labels/TemplatedLabelDialog";
import { computeLabelLayout, formatDateDDMMYY, type LabelData } from "@/lib/labelLayout";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useCompany();
  const { departments } = useDepartments();
  const { param: ruleParam } = useLabelRules();
  const { session } = useAuth();
  const { operator } = useOperatorSession();
  const [product, setProduct] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [blastChillings, setBlastChillings] = useState<any[]>([]);
  const [holdingRecords, setHoldingRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelTemplates, setLabelTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [adminDeptName, setAdminDeptName] = useState<string>("");
  const [preservationOverride, setPreservationOverride] = useState<"fresh" | "vacuum" | "">("");
  const [allergenKeywordsDb, setAllergenKeywordsDb] = useState<string[] | null>(null);
  const [allergenNamesDb, setAllergenNamesDb] = useState<string[]>([]);
  // Mappa keyword(lowercase) -> nome canonico dell'allergene (es. "grano" -> "Glutine").
  const [allergenKeyToName, setAllergenKeyToName] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      if (!session && operator?.is_admin && operator?.pin) {
        const { data: res } = await supabase.rpc("operator_admin_get_product" as any, {
          p_operator_id: operator.id,
          p_pin: operator.pin,
          p_id: id,
        });
        const payload = res as { ok: boolean; product?: any; ingredients?: any[]; label_templates?: any[]; department_name?: string } | null;
        if (payload?.ok) {
          setProduct(payload.product);
          setIngredients(payload.ingredients ?? []);
          setAdminDeptName(payload.department_name ?? "");
          const tpls = payload.label_templates ?? [];
          setLabelTemplates(tpls);
          const def = tpls.find((t: any) => t.is_default);
          if (def) setSelectedTemplate(def.id);
          else if (tpls.length > 0) setSelectedTemplate(tpls[0].id);
        }
        setLoading(false);
        return;
      }
      const { data: prod } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      setProduct(prod);

      const { data: links } = await supabase
        .from("product_ingredients")
        .select("raw_materials(id, product_name, internal_lot, supplier_name, supplier_lot, origin, quantity, expiry_date, category, born_in, raised_in, slaughtered_in, meat_type, slaughter_mark, ingredients)")
        .eq("product_id", id);

      setIngredients((links ?? []).map((l: any) => l.raw_materials).filter(Boolean));

      // Load related blast chillings (per product_id o per lotto nel nome)
      const lot = prod?.internal_lot;
      const { data: bcById } = await (supabase as any)
        .from("blast_chillings")
        .select("*")
        .eq("product_id", id)
        .order("started_at", { ascending: false });
      let bcRows = bcById ?? [];
      if (lot) {
        const { data: bcByLot } = await (supabase as any)
          .from("blast_chillings")
          .select("*")
          .ilike("product_name", `%${lot}%`)
          .order("started_at", { ascending: false });
        const seen = new Set(bcRows.map((r: any) => r.id));
        for (const r of (bcByLot ?? [])) if (!seen.has(r.id)) bcRows.push(r);
      }
      setBlastChillings(bcRows);

      // Load related holding records (per lotto nel nome o note)
      let hRows: any[] = [];
      if (lot) {
        const { data: hByName } = await (supabase as any)
          .from("holding_records")
          .select("*")
          .ilike("product_name", `%${lot}%`)
          .order("recorded_at", { ascending: false });
        const { data: hByNotes } = await (supabase as any)
          .from("holding_records")
          .select("*")
          .ilike("notes", `%${lot}%`)
          .order("recorded_at", { ascending: false });
        const seen = new Set<string>();
        for (const r of [...(hByName ?? []), ...(hByNotes ?? [])]) {
          if (!seen.has(r.id)) { seen.add(r.id); hRows.push(r); }
        }
      }
      setHoldingRecords(hRows);

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
  }, [id, session?.user?.id, operator?.id]);

  // Carica le keyword degli allergeni dalla scheda dedicata (solo se autenticati).
  // Quando il flusso è admin-operator senza sessione, ricadiamo sull'elenco di legge.
  useEffect(() => {
    if (!session?.user) { setAllergenKeywordsDb(null); return; }
    (async () => {
      const { data } = await supabase
        .from("allergens" as any)
        .select("name, keywords")
        .eq("user_id", session.user.id);
      const all = (((data as any[]) ?? [])
        .flatMap((r) => (r.keywords as string[]) || []))
        .map((k) => (k || "").toLowerCase().trim())
        .filter(Boolean);
      setAllergenKeywordsDb(Array.from(new Set(all)));
      const names = (((data as any[]) ?? [])
        .map((r) => (r.name || "").toLowerCase().trim())
        .filter(Boolean));
      setAllergenNamesDb(Array.from(new Set(names)));
      const map: Record<string, string> = {};
      for (const r of (data as any[]) ?? []) {
        const canonical = (r.name || "").toString().trim();
        if (!canonical) continue;
        for (const kw of (r.keywords as string[]) || []) {
          const k = (kw || "").toLowerCase().trim();
          if (k && !map[k]) map[k] = canonical;
        }
        const nk = canonical.toLowerCase();
        if (!map[nk]) map[nk] = canonical;
      }
      setAllergenKeyToName(map);
    })();
  }, [session?.user?.id]);

  // ============================================================
  // Composizione semantica dei dati etichetta (LabelData)
  // ============================================================
  // Sostituisce la vecchia logica a placeholder/valueMap: tutta la
  // grafica passa ora attraverso `computeLabelLayout` (shared lib),
  // mentre qui restano solo le business rules di Archivio (Salumeria,
  // Macelleria, Cucina) per popolare i campi semantici.

  const MEAT_KEYWORDS: Record<string, string> = {
    tacchino: "tacchino", pollo: "pollo", gallina: "gallina", cappone: "cappone",
    manzo: "manzo", bovino: "bovino", bovina: "bovino", vitello: "vitello", vitellone: "vitellone",
    suino: "suino", maiale: "suino", agnello: "agnello", pecora: "pecora", capra: "capra", capretto: "capretto",
    coniglio: "coniglio", cavallo: "cavallo", anatra: "anatra", oca: "oca", faraona: "faraona",
    cinghiale: "cinghiale", struzzo: "struzzo", quaglia: "quaglia",
  };
  function detectMeat(name: string): string | null {
    const n = (name || "").toLowerCase();
    for (const k of Object.keys(MEAT_KEYWORDS)) if (n.includes(k)) return MEAT_KEYWORDS[k];
    return null;
  }

  // Allergeni di legge (Reg. UE 1169/2011, All. II): fallback se la tabella
  // `allergens` dell'utente è vuota.
  const ALLERGEN_KEYWORDS_DEFAULT: string[] = [
    "glutine","grano","frumento","segale","orzo","avena","farro","kamut","khorasan","spelta","seitan","malto",
    "crostacei","gambero","gamberi","gamberetti","scampi","scampo","granchio","granchi","aragosta","aragoste",
    "uova","uovo","albume","tuorlo","ovoprodotti",
    "pesce","salmone","tonno","merluzzo","baccalà","sgombro","acciuga","acciughe","alici","sardina","sardine","spigola","branzino","orata","trota","nasello",
    "arachide","arachidi","soia","tofu","edamame",
    "latte","lattosio","burro","panna","formaggio","mozzarella","yogurt","ricotta","caseina","caseinato","siero","stracchino","parmigiano","grana","scamorza","provolone",
    "mandorla","mandorle","nocciola","nocciole","noce","noci","pistacchio","pistacchi","anacardo","anacardi","pecan","macadamia",
    "sedano","senape","sesamo",
    "solfiti","solfito","so2","anidride solforosa","e220","e221","e222","e223","e224","e225","e226","e227","e228",
    "lupino","lupini",
    "mollusco","molluschi","vongola","vongole","cozza","cozze","calamaro","calamari","polpo","polpi","seppia","seppie","ostrica","ostriche","lumaca","lumache",
  ];

  const labelData: LabelData = useMemo(() => {
    const allergensEnabled = ruleParam<boolean>("common", "allergens", "enabled", true);
    const baseAllergens = allergensEnabled
      ? ((allergenKeywordsDb && allergenKeywordsDb.length > 0) ? allergenKeywordsDb : ALLERGEN_KEYWORDS_DEFAULT)
      : [];
    const allergenRegex: RegExp | null = (() => {
      if (baseAllergens.length === 0) return null;
      const sorted = [...new Set(baseAllergens)].sort((a, b) => b.length - a.length);
      return new RegExp(`\\b(${sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
    })();

    const deptName = (
      departments.find((d) => d.id === (product as any)?.department_id)?.name ||
      adminDeptName || ""
    ).toLowerCase().trim();
    const isSalumeria = deptName.startsWith("salum");
    const isMacelleria = deptName.startsWith("macel");
    const isCucina = deptName.startsWith("cucin");
    const productMeatType: string | null = (product as any)?.meat_type ?? null;
    const effectiveMeatType: string | null = isCucina ? "preparato" : productMeatType;

    // ---- Composizione testo ingredienti ----
    type IngPart = { text: string; bold: boolean };
    const meats: IngPart[] = [], aromas: IngPart[] = [], additives: IngPart[] = [], others: IngPart[] = [];
    const extraHighlights = new Set<string>();
    const seen = new Set<string>();
    const normTok = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const take = (s: string) => { const k = normTok(s); if (!k || seen.has(k)) return false; seen.add(k); return true; };

    const salumeriaSingle = isSalumeria && Array.isArray(ingredients) && ingredients.length === 1
      && !!((ingredients[0] as any)?.ingredients && String((ingredients[0] as any).ingredients).trim());

    for (const m of ingredients as any[]) {
      const cat = m.category || "materia_prima";
      if (cat === "aroma") {
        if (m.product_name && take(m.product_name)) aromas.push({ text: m.product_name, bold: false });
      } else if (cat === "additivo_allergene") {
        const nameLc = (m.product_name || "").toLowerCase().trim();
        const isAllergen = allergenNamesDb.includes(nameLc);
        const codes = (m.ingredients && String(m.ingredients).trim()) || "";
        if (isAllergen || !codes) {
          if (m.product_name && take(m.product_name)) {
            additives.push({ text: m.product_name, bold: true });
            extraHighlights.add(m.product_name);
          }
        } else {
          codes.split(",").map((c) => c.trim()).filter(Boolean).forEach((c) => {
            if (take(c)) { additives.push({ text: c, bold: true }); extraHighlights.add(c); }
          });
        }
      } else {
        if (salumeriaSingle) {
          String((m as any).ingredients || "").split(",").map((s) => s.trim()).filter(Boolean)
            .forEach((s) => { if (take(s)) others.push({ text: s, bold: false }); });
          continue;
        }
        const meat = detectMeat(m.product_name);
        const traceCountries = [m.born_in, m.raised_in, m.slaughtered_in]
          .map((v) => (v ? String(v).trim() : "")).filter(Boolean);
        const rawOrigin = (m.origin && String(m.origin).trim()) || traceCountries[0] || "";
        let origin = rawOrigin || "UE";
        if (traceCountries.length > 0) {
          const norm = traceCountries.map((c) => c.toLowerCase());
          const allItaly = norm.every((c) => c === "italia" || c === "italy" || c === "it");
          origin = allItaly ? "Italia" : "UE";
        }
        const subIngredients = (m.ingredients && String(m.ingredients).trim()) || "";
        if (meat && !subIngredients) {
          const txt = `carne di ${meat} (${origin})`;
          if (take(txt)) meats.push({ text: txt, bold: false });
        } else if (subIngredients) {
          const subs = subIngredients.split(",").map((s) => s.trim()).filter(Boolean);
          const uniqueSubs = subs.filter((s) => take(s));
          const nameOk = m.product_name && take(m.product_name);
          if (nameOk && uniqueSubs.length) others.push({ text: `${m.product_name} (${uniqueSubs.join(", ")})`, bold: false });
          else if (nameOk) others.push({ text: m.product_name, bold: false });
          else uniqueSubs.forEach((s) => others.push({ text: s, bold: false }));
        } else if (m.product_name && take(m.product_name)) {
          others.push({ text: `${m.product_name} (${origin})`, bold: false });
        }
      }
    }

    const parts: IngPart[] = [...meats, ...others, ...aromas, ...additives];
    const manualRaw = ((product as any)?.manual_ingredients || "").toString().trim();
    if (manualRaw) {
      manualRaw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
        .forEach((t) => { if (take(t)) parts.push({ text: t, bold: false }); });
    }
    // Carne fresca monocomponente (Macelleria): NO ingredienti stampati,
    // solo tracciabilità (Nato/Allevato/Macellato).
    const skipIngredients = productMeatType === "fresh" && !isCucina;
    const ingredientsText = skipIngredients ? "" : parts.map((p) => p.text).join(", ");

    // ---- Tracciabilità carne ----
    const freshLines: string[] = [];
    const prepCountries = new Set<string>();
    const freshMap = new Map<string, { born: Set<string>; raised: Set<string>; slaughter: Set<string>; marks: Set<string> }>();
    for (const m of ingredients as any[]) {
      const name = m.product_name || "carne";
      if (effectiveMeatType === "preparato") {
        [m.born_in, m.raised_in, m.slaughtered_in].forEach((v: string | null) => {
          const t = (v || "").trim(); if (t) prepCountries.add(t);
        });
        continue;
      }
      if (!m.born_in && !m.raised_in && !m.slaughtered_in && !m.slaughter_mark) continue;
      if (!freshMap.has(name)) freshMap.set(name, { born: new Set(), raised: new Set(), slaughter: new Set(), marks: new Set() });
      const t = freshMap.get(name)!;
      if (m.born_in) t.born.add(m.born_in);
      if (m.raised_in) t.raised.add(m.raised_in);
      if (m.slaughtered_in) t.slaughter.add(m.slaughtered_in);
      if (m.slaughter_mark) t.marks.add(m.slaughter_mark);
    }
    freshMap.forEach((t) => {
      if (t.born.size) freshLines.push(`Nato in: ${[...t.born].join("/")}`);
      if (t.raised.size) freshLines.push(`Allevato in: ${[...t.raised].join("/")}`);
      if (t.slaughter.size) {
        const mark = t.marks.size ? ` ${[...t.marks].join("/")}` : "";
        freshLines.push(`Macellato in: ${[...t.slaughter].join("/")}` + mark);
      }
    });
    const traceLines: string[] = [];
    if (effectiveMeatType === "preparato" && prepCountries.size > 0) {
      const norm = [...prepCountries].map((c) => c.toLowerCase().trim());
      const allItaly = norm.every((c) => c === "italia" || c === "italy" || c === "it");
      traceLines.push(`Carne origine: ${allItaly ? "IT" : "UE"}`);
    }

    // ---- Allergeni (Reg. UE 1169/2011) — riga "Contiene:" ----
    let allergensLine: string | undefined;
    if (effectiveMeatType === "preparato" && allergenRegex) {
      const haystack: string[] = [];
      for (const m of ingredients as any[]) {
        if (m?.product_name) haystack.push(String(m.product_name));
        if (m?.ingredients) haystack.push(String(m.ingredients));
      }
      if (manualRaw) haystack.push(manualRaw);
      const found = new Set<string>();
      const re = new RegExp(allergenRegex.source, allergenRegex.flags);
      for (const text of haystack) {
        let mm: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((mm = re.exec(text)) !== null) {
          const kw = mm[0].toLowerCase();
          const canonical = allergenKeyToName[kw] || mm[0];
          found.add(canonical);
          if (mm[0].length === 0) re.lastIndex++;
        }
      }
      if (found.size > 0) allergensLine = `Contiene: ${[...found].join(", ")}`;
    }

    // ---- Scadenza: priorità DB (products.expiry_date), poi calcolo Salumeria ----
    const dbExpiry = (product as any)?.expiry_date
      ? formatDateDDMMYY((product as any).expiry_date)
      : null;
    let salumeriaExpiry: string | null = null;
    if (isSalumeria && (product as any)?.production_date) {
      const pd = new Date(String((product as any).production_date) + "T00:00:00");
      if (!isNaN(pd.getTime())) {
        const type = (preservationOverride || ((product as any)?.preservation_type as string) || "vacuum");
        const key = type === "fresh" ? "days_fresh" : "days_vacuum";
        const fallback = type === "fresh" ? 5 : 30;
        const shelf = Math.max(1, Number(ruleParam<number>("salumeria", "shelf_life", key, fallback)) || fallback);
        pd.setDate(pd.getDate() + shelf);
        salumeriaExpiry = formatDateDDMMYY(pd.toISOString().slice(0, 10));
      }
    }
    // Override Salumeria attivo (preservationOverride) → ricalcolo > DB.
    const finalExpiry = (isSalumeria && preservationOverride && salumeriaExpiry)
      ? salumeriaExpiry
      : (dbExpiry || salumeriaExpiry);
    const expiryLine = finalExpiry ? `Da consumarsi entro il: ${finalExpiry}` : undefined;

    // ---- Lotto (Macelleria fresh → supplier_lot) ----
    let macelleriaFreshLot = "";
    if (isMacelleria && productMeatType === "fresh") {
      const lots = (ingredients as any[])
        .map((m) => (m?.supplier_lot ? String(m.supplier_lot).trim() : "")).filter(Boolean);
      macelleriaFreshLot = [...new Set(lots)].join(" / ");
    }

    // ---- Avviso conservazione (Macelleria/Cucina) ----
    const extraLines: string[] = [...freshLines, ...traceLines];
    if (productMeatType || isCucina) {
      const noticeKey = isCucina ? "cucina"
        : (productMeatType === "preparato" ? "macelleria_preparato" : "macelleria_fresh");
      const noticeText = ruleParam<string>(noticeKey, "notice", "text", "Conservare da 0° e +4° — Consumare previa cottura");
      if (noticeText) extraLines.push(noticeText);
    }

    return {
      productName: product?.name ?? "",
      companyName: company?.business_name ?? "",
      companyAddress: [company?.address, (company as any)?.city]
        .map((s) => (s ?? "").toString().trim()).filter(Boolean).join(" — "),
      productionDate: formatDateDDMMYY((product as any)?.production_date),
      internalLot: macelleriaFreshLot || (product as any)?.internal_lot || "—",
      ingredientsText,
      extraLines,
      expiryLine,
      allergensLine,
      highlightAllergens: [...baseAllergens, ...Array.from(extraHighlights)],
    };
  }, [product, ingredients, company, departments, adminDeptName, ruleParam,
      preservationOverride, allergenKeywordsDb, allergenNamesDb, allergenKeyToName]);

  // Report A5 (etichetta ingrandita su foglio A5) — usa lo stesso layout grafico.
  function printLabelA5() {
    if (!product) return;
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate) || labelTemplates[0];
    if (!tpl) { toast.error("Nessun template etichetta disponibile"); return; }
    const wMm = Number(tpl.width_mm), hMm = Number(tpl.height_mm);
    const { items } = computeLabelLayout(labelData, wMm, hMm);
    const pageW = 148, pageH = 210, margin = 12;
    const scale = Math.min((pageW - 2 * margin) / wMm, (pageH - 2 * margin) / hMm);
    const scaledW = wMm * scale, scaledH = hMm * scale;
    const escapeHtml = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
    const itemsHtml = items.map((it) => {
      const segs = it.segments.map((s) => `<span style="font-weight:${s.bold ? 700 : 400}">${escapeHtml(s.text)}</span>`).join("");
      return `<div style="position:absolute;left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;font-size:${it.fontPt}pt;line-height:${it.lineHeight};text-align:${it.align};word-break:break-word;overflow:hidden;">${segs}</div>`;
    }).join("");
    const headerHtml = `
      <div style="position:absolute;left:${margin}mm;top:${margin}mm;right:${margin}mm;font-size:9pt;color:#444;border-bottom:1px solid #ccc;padding-bottom:3mm;">
        <div style="font-weight:700;font-size:11pt;color:#000;">${escapeHtml(company?.business_name ?? "")}</div>
        <div>${escapeHtml(product?.name ?? "")} — Lotto ${escapeHtml((product as any)?.internal_lot ?? "")}</div>
      </div>`;
    const labelTopMm = margin + 14;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etichetta A5 — ${escapeHtml(product?.name ?? "")}</title>
<style>@page{size:A5 portrait;margin:0}html,body{margin:0;padding:0;background:#fff;font-family:Helvetica,Arial,sans-serif;color:#000}.page{position:relative;width:${pageW}mm;height:${pageH}mm}.label-wrap{position:absolute;left:${(pageW - scaledW) / 2}mm;top:${labelTopMm}mm;width:${scaledW}mm;height:${scaledH}mm;border:1px dashed #888;box-sizing:border-box;overflow:hidden}.label{position:relative;width:${wMm}mm;height:${hMm}mm;transform:scale(${scale});transform-origin:top left}@media screen{body{padding:12px;background:#f5f5f5}.page{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15);margin:0 auto}.actions{position:fixed;top:8px;right:8px;z-index:10}.actions button{padding:10px 16px;font-size:14px;border:0;border-radius:8px;background:#0a7;color:#fff}}@media print{.actions{display:none!important}body{padding:0;background:#fff}}</style></head>
<body><div class="actions"><button onclick="window.print()">Stampa</button></div>
<div class="page">${headerHtml}<div class="label-wrap"><div class="label">${itemsHtml}</div></div></div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.open(); win.document.write(html); win.document.close(); }
    else { const url = URL.createObjectURL(new Blob([html], { type: "text/html" })); window.location.href = url; }
  }


  async function removeIngredient(rawId: string) {
    if (!session?.user) {
      toast.error("Operazione disponibile solo per il titolare loggato.");
      return;
    }
    if (!confirm("Rimuovere questo ingrediente dal prodotto?")) return;
    const { error } = await supabase
      .from("product_ingredients")
      .delete()
      .eq("product_id", id!)
      .eq("raw_material_id", rawId);
    if (error) return toast.error(error.message);
    setIngredients((prev) => prev.filter((m: any) => m.id !== rawId));
    toast.success("Ingrediente rimosso");
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

    if (blastChillings.length > 0) {
      doc.setFontSize(13);
      doc.text("Abbattimenti", 14, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Ciclo", "T inizio", "T fine", "Inizio", "Fine", "Durata", "Esito"]],
        body: blastChillings.map((b) => {
          const dur = b.ended_at ? Math.round((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 60000) + " min" : "—";
          return [
            b.cycle_type === "negative" ? "Negativo (-18°C)" : "Positivo (+3°C)",
            b.temp_start != null ? `${b.temp_start}°C` : "—",
            b.temp_end != null ? `${b.temp_end}°C` : "—",
            b.started_at ? new Date(b.started_at).toLocaleString("it-IT") : "—",
            b.ended_at ? new Date(b.ended_at).toLocaleString("it-IT") : "In corso",
            dur,
            b.outcome === "ok" ? "Conforme" : "Anomalia",
          ];
        }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (holdingRecords.length > 0) {
      doc.setFontSize(13);
      doc.text("Mantenimento & Rigenerazione", 14, y);
      y += 6;
      const MODE_LBL: Record<string, string> = {
        hot: "Caldo ≥60°C",
        cold: "Freddo ≤4°C",
        regeneration: "Rigenerazione ≥70°C",
      };
      autoTable(doc, {
        startY: y,
        head: [["Modalità", "°C", "Rilevato", "Esito", "Note"]],
        body: holdingRecords.map((h) => [
          MODE_LBL[h.mode] ?? h.mode,
          h.temperature != null ? `${h.temperature}°C` : "—",
          h.recorded_at ? new Date(h.recorded_at).toLocaleString("it-IT") : "—",
          h.outcome === "ok" ? "Conforme" : h.outcome === "anomaly" ? "Anomalia" : "Da completare",
          h.notes ?? "—",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

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
          <>
            <Button onClick={() => setShowLabelDialog(true)} variant="outline" className="mt-5 ml-2 gap-2">
              <Printer size={16} /> Stampa Etichetta
            </Button>
            <Button onClick={printLabelA5} variant="outline" className="mt-5 ml-2 gap-2">
              <FileText size={16} /> Report A5
            </Button>
          </>
        )}
      </Card>

      {blastChillings.length > 0 && (
        <Card className="p-5 mb-6">
          <h3 className="font-display font-bold mb-3">Abbattimenti</h3>
          <div className="space-y-2">
            {blastChillings.map((b) => {
              const dur = b.ended_at ? Math.round((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 60000) : null;
              return (
                <div key={b.id} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold">
                      {b.cycle_type === "negative" ? "Surgelazione (-18°C)" : "Abbattimento (+3°C)"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-md ${b.outcome === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-destructive/15 text-destructive"}`}>
                      {b.ended_at ? (b.outcome === "ok" ? "Conforme" : "Anomalia") : "Da completare"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5">
                    {new Date(b.started_at).toLocaleString("it-IT")}
                    {b.ended_at && ` → ${new Date(b.ended_at).toLocaleString("it-IT")}`}
                    {dur != null && ` • ${dur} min`}
                    {b.temp_start != null && ` • ${b.temp_start}°C → ${b.temp_end ?? "—"}°C`}
                  </div>
                  {b.notes && <div className="text-xs text-muted-foreground mt-1">{b.notes}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <TemplatedLabelDialog
        open={showLabelDialog}
        onOpenChange={(v) => { setShowLabelDialog(v); if (!v) setPreservationOverride(""); }}
        data={labelData}
        title="Stampa etichetta"
        templatesOverride={labelTemplates as any}
        extraControls={(() => {
          const deptName = (
            departments.find((d) => d.id === (product as any)?.department_id)?.name ||
            adminDeptName || ""
          ).toLowerCase().trim();
          if (!deptName.startsWith("salum")) return null;
          const current = preservationOverride || ((product as any)?.preservation_type as string) || "vacuum";
          return (
            <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 space-y-1.5">
              <Label className="text-xs font-semibold text-emerald-900">Tipo conservazione per questa stampa</Label>
              <Select value={current} onValueChange={(v: "fresh" | "vacuum") => setPreservationOverride(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacuum">Sottovuoto</SelectItem>
                  <SelectItem value="fresh">Fresco</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-emerald-900/80">
                Override Salumeria: ricalcola la scadenza in tempo reale nell'anteprima.
              </p>
            </div>
          );
        })()}
      />

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
              className="p-4 hover:bg-muted/40 transition flex items-center justify-between gap-3"
            >
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => navigate(`/archivio/materia-prima/${m.id}`)}
              >
                <div className="font-semibold truncate">{m.product_name}</div>
                <div className="text-xs text-muted-foreground">
                  {m.supplier_name || "—"} • <span className="font-mono">{m.internal_lot}</span>
                  {m.origin && <> • Origine: {m.origin}</>}
                </div>
              </div>
              {session?.user && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); removeIngredient(m.id); }}
                  title="Rimuovi dal prodotto"
                >
                  <Trash2 size={16} className="text-destructive" />
                </Button>
              )}
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