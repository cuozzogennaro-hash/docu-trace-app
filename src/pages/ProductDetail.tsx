import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Bluetooth, FileDown, Loader2, Printer, Trash2, FileText } from "lucide-react";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";
import { useLabelRules } from "@/hooks/useLabelRules";

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
  const [labelQty, setLabelQty] = useState(1);
  const [btPrinting, setBtPrinting] = useState(false);
  const [adminDeptName, setAdminDeptName] = useState<string>("");
  const [preservationOverride, setPreservationOverride] = useState<"fresh" | "vacuum" | "">("");
  const [allergenKeywordsDb, setAllergenKeywordsDb] = useState<string[] | null>(null);
  const [allergenNamesDb, setAllergenNamesDb] = useState<string[]>([]);

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
    })();
  }, [session?.user?.id]);

  const PX_PER_MM = 3.78;

  // Mappa parole chiave -> nome carne usato in etichetta
  const MEAT_KEYWORDS: Record<string, string> = {
    tacchino: "tacchino",
    pollo: "pollo",
    gallina: "gallina",
    cappone: "cappone",
    manzo: "manzo",
    bovino: "bovino",
    bovina: "bovino",
    vitello: "vitello",
    vitellone: "vitellone",
    suino: "suino",
    maiale: "suino",
    agnello: "agnello",
    pecora: "pecora",
    capra: "capra",
    capretto: "capretto",
    coniglio: "coniglio",
    cavallo: "cavallo",
    anatra: "anatra",
    oca: "oca",
    faraona: "faraona",
    cinghiale: "cinghiale",
    struzzo: "struzzo",
    quaglia: "quaglia",
  };

  function detectMeat(name: string): string | null {
    const n = (name || "").toLowerCase();
    for (const k of Object.keys(MEAT_KEYWORDS)) {
      if (n.includes(k)) return MEAT_KEYWORDS[k];
    }
    return null;
  }

  type IngPart = { text: string; bold: boolean };

  // Allergeni di legge (Reg. UE 1169/2011, All. II) e relativi derivati comuni.
  // Qualsiasi occorrenza (case-insensitive, parola intera) verrà evidenziata
  // in grassetto nel testo degli ingredienti dell'etichetta, in tutti i reparti.
  const ALLERGEN_KEYWORDS_DEFAULT: string[] = [
    // 1. Glutine
    "glutine","grano","frumento","segale","orzo","avena","farro","kamut","khorasan","spelta","seitan","malto",
    // 2. Crostacei
    "crostacei","gambero","gamberi","gamberetti","scampi","scampo","granchio","granchi","aragosta","aragoste",
    // 3. Uova
    "uova","uovo","albume","tuorlo","ovoprodotti",
    // 4. Pesce
    "pesce","salmone","tonno","merluzzo","baccalà","sgombro","acciuga","acciughe","alici","sardina","sardine","spigola","branzino","orata","trota","nasello",
    // 5. Arachidi
    "arachide","arachidi",
    // 6. Soia
    "soia","tofu","edamame",
    // 7. Latte
    "latte","lattosio","burro","panna","formaggio","mozzarella","yogurt","ricotta","caseina","caseinato","siero","stracchino","parmigiano","grana","scamorza","provolone",
    // 8. Frutta a guscio
    "mandorla","mandorle","nocciola","nocciole","noce","noci","pistacchio","pistacchi","anacardo","anacardi","pecan","macadamia",
    // 9. Sedano
    "sedano",
    // 10. Senape
    "senape",
    // 11. Sesamo
    "sesamo",
    // 12. Solfiti / Anidride solforosa
    "solfiti","solfito","so2","anidride solforosa",
    "e220","e221","e222","e223","e224","e225","e226","e227","e228",
    // 13. Lupini
    "lupino","lupini",
    // 14. Molluschi
    "mollusco","molluschi","vongola","vongole","cozza","cozze","calamaro","calamari","polpo","polpi","seppia","seppie","ostrica","ostriche","lumaca","lumache",
  ];

  // Lista effettiva: l'evidenziazione può essere disattivata dalla regola
  // "Evidenziazione allergeni" (Logiche etichette). Le parole arrivano dalla
  // scheda Allergeni (tabella dedicata); se non disponibile, fallback alla
  // lista di legge.
  const _allergenEnabled = ruleParam<boolean>("common", "allergens", "enabled", true);
  const ALLERGEN_KEYWORDS: string[] = _allergenEnabled
    ? ((allergenKeywordsDb && allergenKeywordsDb.length > 0) ? allergenKeywordsDb : ALLERGEN_KEYWORDS_DEFAULT)
    : [];

  // Pattern unico per il matching: parole intere, case-insensitive.
  // Le parole più lunghe per prime così che "anidride solforosa" vinca su "anidride".
  const ALLERGEN_REGEX: RegExp | null = (() => {
    if (!ALLERGEN_KEYWORDS || ALLERGEN_KEYWORDS.length === 0) return null;
    const sorted = [...new Set(ALLERGEN_KEYWORDS)].sort((a, b) => b.length - a.length);
    const escaped = sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  })();

  // Spezza un testo in segmenti {text, bold} con in grassetto le parole allergeniche.
  function splitAllergenSegments(text: string, baseBold: boolean): { text: string; bold: boolean }[] {
    if (!text) return [{ text: "", bold: baseBold }];
    if (baseBold) return [{ text, bold: true }];
    if (!ALLERGEN_REGEX) return [{ text, bold: false }];
    const out: { text: string; bold: boolean }[] = [];
    let last = 0;
    const re = new RegExp(ALLERGEN_REGEX.source, ALLERGEN_REGEX.flags);
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

  function getValueMap() {
    const meats: IngPart[] = [];
    const aromas: IngPart[] = [];
    const additives: IngPart[] = [];
    const others: IngPart[] = [];

    // Reparto del prodotto: per la Salumeria vogliamo elencare TUTTI gli
    // ingredienti selezionati per nome (eventualmente con i loro sotto-
    // ingredienti tra parentesi), senza sostituire il nome del prodotto
    // composto con la sua sola lista interna.
    const _deptName = (
      departments.find((d) => d.id === (product as any)?.department_id)?.name ||
      adminDeptName ||
      ""
    ).toLowerCase().trim();
    const _isSalumeria = _deptName.startsWith("salum");

    for (const m of ingredients as any[]) {
      const cat = m.category || "materia_prima";
      if (cat === "aroma") {
        aromas.push({ text: m.product_name, bold: false });
      } else if (cat === "additivo_allergene") {
        // Distinguiamo additivi veri (es. "E250, E301") da materie prime che
        // sono allergeni (es. "Latte"). Per gli allergeni stampiamo SOLO il
        // nome del prodotto in grassetto, NON l'elenco dei derivati eventualmente
        // salvato nel campo "ingredienti".
        const nameLc = (m.product_name || "").toLowerCase().trim();
        const isAllergen = allergenNamesDb.includes(nameLc);
        const codes = (m.ingredients && String(m.ingredients).trim()) || "";
        if (isAllergen || !codes) {
          additives.push({ text: m.product_name, bold: true });
        } else {
          codes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((c) => additives.push({ text: c, bold: true }));
        }
      } else {
          const meat = detectMeat(m.product_name);
          // Per Macelleria l'origine non è in `origin` ma nei campi di
          // tracciabilità (nato/allevato/macellato). Deriviamo l'origine
          // dalla prima fonte disponibile, normalizzando "Italia" -> "Italia".
          const traceCountries = [m.born_in, m.raised_in, m.slaughtered_in]
            .map((v) => (v ? String(v).trim() : ""))
            .filter(Boolean);
          const rawOrigin = (m.origin && String(m.origin).trim()) || traceCountries[0] || "";
          let origin = rawOrigin || "UE";
          if (traceCountries.length > 0) {
            const norm = traceCountries.map((c) => c.toLowerCase());
            const allItaly = norm.every((c) => c === "italia" || c === "italy" || c === "it");
            origin = allItaly ? "Italia" : "UE";
          }
          const subIngredients = (m.ingredients && String(m.ingredients).trim()) || "";
          if (_isSalumeria) {
            // Salumeria: mostra SEMPRE il nome del prodotto; se ha una
            // sotto-lista di ingredienti, la accodiamo tra parentesi.
            const label = subIngredients
              ? `${m.product_name} (${subIngredients})`
              : m.product_name;
            others.push({ text: label, bold: false });
          } else if (meat) {
            meats.push({ text: `carne di ${meat} (${origin})`, bold: false });
          } else if (subIngredients) {
            // Materia prima già lavorata (es. Salumeria): in etichetta riportiamo
            // SOLO la sua lista ingredienti, non il nome del prodotto.
            subIngredients
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((ing) => others.push({ text: ing, bold: false }));
          } else {
            others.push({ text: `${m.product_name} (${origin})`, bold: false });
          }
      }
    }

    const parts: IngPart[] = [...meats, ...others, ...aromas, ...additives];
    // Ingredienti scritti a mano (campo manual_ingredients sul prodotto):
    // li accodiamo come voci aggiuntive in etichetta.
    const manualRaw = ((product as any)?.manual_ingredients || "").toString().trim();
    if (manualRaw) {
      manualRaw
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((t) => parts.push({ text: t, bold: false }));
    }
    const ingredientsList = parts.map((p) => p.text).join(", ");
    return {
      valueMap: {
        company_name: company?.business_name ?? "",
        product_name: product?.name ?? "",
        internal_lot: `Lotto: ${product?.internal_lot ?? ""}`,
        production_date: `Data prod.: ${product?.production_date ?? "—"}`,
        expiry_date: `Scadenza: ${ingredients[0]?.expiry_date ?? "—"}`,
        ingredients: `Ingr.: ${ingredientsList || "—"}`,
        company_address: company?.address ?? "",
      } as Record<string, string>,
      ingredientParts: parts,
    };
  }

  // ---------- Layout etichetta (sorgente unica condivisa) ----------
  // Formato data GG/MM/AA
  function formatDateDDMMYY(s?: string | null): string {
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

  type LabelSeg = { text: string; bold: boolean };
  type LabelItem = {
    x: number; y: number; w: number; // mm
    fontPt: number;
    align: "left" | "center" | "right";
    segments: LabelSeg[];
    lineHeight: number;
  };
  type PrintLabelField = {
    key: string;
    label?: string;
    visible?: boolean;
    x: number;
    y: number;
    fontSize: number;
    bold?: boolean;
    width?: number;
    height?: number;
  };

  function computeLabelLayout(wMm: number, hMm: number) {
    const { ingredientParts } = getValueMap();
    // Traceability for Macelleria, driven by the PRODUCT's meat_type:
    // - "preparato": simplified "<nome> origine: <origin>"
    // - otherwise (fresh / default): Nato / Allevato / Macellato + Bollo CE
    const productMeatType: string | null = (product as any)?.meat_type ?? null;
    const productDeptName = (
      departments.find((d) => d.id === (product as any)?.department_id)?.name ||
      adminDeptName ||
      ""
    ).toLowerCase().trim();
    const isSalumeria = productDeptName.startsWith("salum");
    const isMacelleria = productDeptName.startsWith("macel");
    const isCucina = productDeptName.startsWith("cucin");
    // Per il reparto Cucina applichiamo la stessa logica dei "Preparati /
    // Trasformati (Multicomponente)" della Macelleria: meat traceability
    // aggregata in una riga "Carne origine: IT/UE" e avviso di conservazione.
    const effectiveMeatType: string | null = isCucina ? "preparato" : productMeatType;
    // Macelleria + Carne Fresca (monocomponente): in etichetta il lotto stampato
    // deve essere quello del produttore (supplier_lot) inserito in ingresso merce,
    // non il lotto interno del prodotto.
    let macelleriaFreshLot = "";
    if (isMacelleria && productMeatType === "fresh") {
      const lots = (ingredients as any[])
        .map((m) => (m?.supplier_lot ? String(m.supplier_lot).trim() : ""))
        .filter(Boolean);
      macelleriaFreshLot = [...new Set(lots)].join(" / ");
    }
    // Salumeria: scadenza automatica = data produzione + 30 giorni
    let salumeriaExpiry = "";
    if (isSalumeria && product?.production_date) {
      const pd = new Date(String(product.production_date) + "T00:00:00");
      if (!isNaN(pd.getTime())) {
          const _type = (preservationOverride || ((product as any)?.preservation_type as string) || "vacuum");
          const _key = _type === "fresh" ? "days_fresh" : "days_vacuum";
          const _fallback = _type === "fresh" ? 5 : 30;
          const _shelf = Math.max(1, Number(ruleParam<number>("salumeria", "shelf_life", _key, _fallback)) || _fallback);
        pd.setDate(pd.getDate() + _shelf);
        salumeriaExpiry = formatDateDDMMYY(pd.toISOString().slice(0, 10));
      }
    }
    const freshMap = new Map<string, { born: Set<string>; raised: Set<string>; slaughter: Set<string>; marks: Set<string> }>();
    const prepCountries = new Set<string>();
    for (const m of ingredients as any[]) {
      const name = m.product_name || "carne";
      if (effectiveMeatType === "preparato") {
        [m.born_in, m.raised_in, m.slaughtered_in].forEach((v: string | null) => {
          const t = (v || "").trim();
          if (t) prepCountries.add(t);
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
    // Linee tracciabilità:
    // - fresh: una riga per Nato, Allevato, Macellato (con bollo accanto, senza "Bollo CE:")
    // - preparato: singola riga "Carne origine: IT/UE"
    const freshLines: string[] = [];
    freshMap.forEach((t) => {
      if (t.born.size) freshLines.push(`Nato in: ${[...t.born].join("/")}`);
      if (t.raised.size) freshLines.push(`Allevato in: ${[...t.raised].join("/")}`);
      if (t.slaughter.size) {
        const slaughter = `Macellato in: ${[...t.slaughter].join("/")}`;
        const mark = t.marks.size ? ` ${[...t.marks].join("/")}` : "";
        freshLines.push(slaughter + mark);
      }
    });
    const traceLines: string[] = [];
    if (effectiveMeatType === "preparato" && prepCountries.size > 0) {
      const norm = [...prepCountries].map((c) => c.toLowerCase().trim());
      const allItaly = norm.every((c) => c === "italia" || c === "italy" || c === "it");
      traceLines.push(`Carne origine: ${allItaly ? "IT" : "UE"}`);
    }
    const data = {
      companyName: company?.business_name ?? "",
      companyAddress: [company?.address, (company as any)?.city]
        .map((s) => (s ?? "").toString().trim())
        .filter(Boolean)
        .join(" — "),
      productName: product?.name ?? "",
      ingredients: ingredientParts,
      traceLines,
      freshLines,
      productionDate: formatDateDDMMYY(product?.production_date),
      internalLot: macelleriaFreshLot || product?.internal_lot || "—",
      salumeriaExpiry,
    };

    // Padding proporzionale (min 1.2mm)
    const p = Math.max(1.2, Math.min(wMm, hMm) * 0.04);
    // Margine di sicurezza extra sul lato destro: la CT221D ha un piccolo
    // bordo non stampabile e il rendering canvas può eccedere di una frazione
    // di mm rispetto a measureText. Senza questo le ultime lettere/cifre
    // dei testi centrati o allineati a destra vengono troncate.
    const safetyR = Math.max(3, wMm * 0.04);
    // Dimensioni font in pt — scalano con altezza etichetta
    const titlePtBase = Math.max(10, Math.round(hMm * 0.34));
    const companyPtBase = Math.max(9, Math.round(hMm * 0.28));
    const ingrPt = Math.max(6, Math.round(hMm * 0.15));
    const addressPt = Math.max(5, Math.round(hMm * 0.11));
    const footerPtBase = Math.max(7, Math.round(hMm * 0.22));
    const lh = 1.2;
    const ptMm = (pt: number) => pt * 0.3528;

    // Misuratore canvas off-screen per auto-fit del font su singola riga
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d")!;
    const measureWidthMm = (text: string, pt: number, bold: boolean) => {
      // 1pt = 0.3528mm, ma per misurare uso px coerenti tra loro
      const px = pt * 4; // scala arbitraria, conta solo il rapporto
      measureCtx.font = `${bold ? "bold " : ""}${px}px Helvetica, Arial, sans-serif`;
      const wPx = measureCtx.measureText(text).width;
      // wPx corrisponde a (pt*4)px → in mm: (wPx / (pt*4)) * pt * 0.3528
      return (wPx / (pt * 4)) * pt * 0.3528;
    };
    const fitPt = (text: string, maxMm: number, startPt: number, minPt: number, bold: boolean) => {
      let pt = startPt;
      while (pt > minPt && measureWidthMm(text, pt, bold) > maxMm) pt -= 0.5;
      return Math.max(minPt, pt);
    };

    // Auto-fit titoli per stare su una riga sola; usa la stessa dimensione
    // (la più piccola fra i due) così che mantengano lo stesso formato.
    const titleMaxMm = wMm - 2 * p - safetyR;
    const titleCompanyPt = fitPt(data.companyName || " ", titleMaxMm, companyPtBase, 8, true);
    const titleProductPt = fitPt(data.productName || " ", titleMaxMm, titlePtBase, 8, true);
    const productPt = titleProductPt;
    const companyPt = Math.min(titleCompanyPt, companyPtBase);

    // Footer: la metà di larghezza ciascuno; auto-fit per evitare overflow
    const footerLeftW = (wMm - 2 * p - safetyR) / 2 - 0.5;
    const footerRightW = (wMm - 2 * p - safetyR) / 2 - 0.5;
    const dataText = `Data Pro.: ${data.productionDate}`;
    const lotText = `Lotto: ${data.internalLot}`;
    const footerPt = Math.min(
      fitPt(dataText, footerLeftW, footerPtBase, 6, false),
      fitPt(lotText, footerRightW, footerPtBase, 6, true),
    );

    const items: LabelItem[] = [];
    let y = p;

    // Nome società
    items.push({
      x: p, y, w: wMm - 2 * p - safetyR,
      fontPt: companyPt, align: "center", lineHeight: lh,
      segments: [{ text: data.companyName, bold: true }],
    });
    y += ptMm(companyPt) * lh + 0.5;

    // Indirizzo società (sotto il nome)
    if (data.companyAddress) {
      // Permetti il wrap su 2 righe per indirizzi lunghi (via + città)
      const addrPt = addressPt;
      items.push({
        x: p, y, w: wMm - 2 * p - safetyR,
        fontPt: addrPt, align: "center", lineHeight: lh,
        segments: [{ text: data.companyAddress, bold: false }],
      });
      // Stima righe per avanzare y correttamente
      const addrLines = Math.max(1, Math.ceil(measureWidthMm(data.companyAddress, addrPt, false) / titleMaxMm));
      y += ptMm(addrPt) * lh * Math.min(addrLines, 2) + 0.4;
    }

    // Nome prodotto (stesso formato)
    items.push({
      x: p, y, w: wMm - 2 * p - safetyR,
      fontPt: productPt, align: "center", lineHeight: lh,
      segments: [{ text: data.productName, bold: true }],
    });
    y += ptMm(productPt) * lh + 0.6;

    // Footer: data prod (sx) + lotto (dx)
    const footerH = ptMm(footerPt) * lh;
    const footerY = hMm - p - footerH;

    // Tracciabilità carne (prima degli ingredienti)
    if (data.freshLines.length > 0) {
      data.freshLines.forEach((line) => {
        items.push({
          x: p, y, w: wMm - 2 * p - safetyR,
          fontPt: ingrPt, align: "left", lineHeight: lh,
          segments: [{ text: line, bold: true }],
        });
        y += ptMm(ingrPt) * lh + 0.2;
      });
      y += 0.3;
    }

    // Ingredienti (riempiono lo spazio fra titolo e footer)
    // Per Carne Fresca (monocomponente) NON stampiamo gli ingredienti:
    // l'etichetta riporta solo la tracciabilità (Nato/Allevato/Macellato).
    if (productMeatType !== "fresh") {
      const ingrSegs: LabelSeg[] = [{ text: "Ingr.: ", bold: true }];
      data.ingredients.forEach((ing, i) => {
        const sep = i < data.ingredients.length - 1 ? ", " : "";
        const parts = splitAllergenSegments(ing.text, ing.bold);
        parts.forEach((p) => ingrSegs.push({ text: p.text, bold: p.bold }));
        if (sep) ingrSegs.push({ text: sep, bold: false });
      });
      if (data.ingredients.length === 0) ingrSegs.push({ text: "—", bold: false });
      items.push({
        x: p, y, w: wMm - 2 * p - safetyR,
        fontPt: ingrPt, align: "left", lineHeight: lh,
        segments: ingrSegs,
      });
    }

    // Data produzione (in basso a sinistra)
    // Avvisi (sopra la riga data/lotto), su una sola riga senza wrap.
    // Macelleria → regole macelleria_fresh / macelleria_preparato.
    // Cucina    → stessa logica del preparato macelleria, regola "cucina".
    if (productMeatType || isCucina) {
      const _noticeKey = isCucina
        ? "cucina"
        : (productMeatType === "preparato" ? "macelleria_preparato" : "macelleria_fresh");
      const noticeText = ruleParam<string>(_noticeKey, "notice", "text", "Conservare da 0° e +4° — Consumare previa cottura");
      const noticePt = fitPt(noticeText, wMm - 2 * p - safetyR, Math.max(5, footerPt * 0.82), 4, false);
      const noticeH = ptMm(noticePt) * lh;
      const noticeY = footerY - noticeH - 0.6;
      items.push({
        x: p, y: noticeY, w: wMm - 2 * p - safetyR,
        fontPt: noticePt, align: "center", lineHeight: lh,
        segments: [{ text: noticeText, bold: false }],
      });
    }

    items.push({
      x: p, y: footerY, w: footerLeftW,
      fontPt: footerPt, align: "left", lineHeight: lh,
      segments: [{ text: dataText, bold: false }],
    });
    // Lotto (in basso a destra) — termina a (wMm - p - safetyR)
    items.push({
      x: wMm - p - safetyR - footerRightW, y: footerY, w: footerRightW,
      fontPt: footerPt, align: "right", lineHeight: lh,
      segments: [{ text: lotText, bold: true }],
    });

    // Salumeria: riga scadenza (sopra la riga data/lotto)
    if (data.salumeriaExpiry) {
      const expiryText = `Da consumarsi entro: ${data.salumeriaExpiry}`;
      const expiryPt = fitPt(expiryText, wMm - 2 * p - safetyR, footerPt, 6, true);
      const expiryH = ptMm(expiryPt) * lh;
      const expiryY = footerY - expiryH - 0.4;
      items.push({
        x: p, y: expiryY, w: wMm - 2 * p - safetyR,
        fontPt: expiryPt, align: "right", lineHeight: lh,
        segments: [{ text: expiryText, bold: true }],
      });
    }

    return items;
  }

  async function printLabel() {
    if (!product) return;
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
    if (!tpl) { toast.error("Seleziona un template"); return; }

    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);

    // Build HTML based on the template configured in Settings → Etichette.
    // This honours visibility, position, size and font choices the user made.
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const { valueMap } = getValueMap();
    // Override formatted values with the rich logic used for bluetooth/auto layout
    const productMeatType: string | null = (product as any)?.meat_type ?? null;
    const productDeptName = (
      departments.find((d) => d.id === (product as any)?.department_id)?.name ||
      adminDeptName ||
      ""
    ).toLowerCase().trim();
    const isSalumeria = productDeptName.startsWith("salum");
    let salumeriaExpiry = "";
    if (isSalumeria && product?.production_date) {
      const pd = new Date(String(product.production_date) + "T00:00:00");
      if (!isNaN(pd.getTime())) {
        const _type = (preservationOverride || ((product as any)?.preservation_type as string) || "vacuum");
        const _key = _type === "fresh" ? "days_fresh" : "days_vacuum";
        const _fallback = _type === "fresh" ? 5 : 30;
        const _shelf = Math.max(1, Number(ruleParam<number>("salumeria", "shelf_life", _key, _fallback)) || _fallback);
        pd.setDate(pd.getDate() + _shelf);
        salumeriaExpiry = formatDateDDMMYY(pd.toISOString().slice(0, 10));
      }
    }
    valueMap.production_date = `Data prod.: ${formatDateDDMMYY(product?.production_date)}`;
    const expiry = salumeriaExpiry || (ingredients[0]?.expiry_date ? formatDateDDMMYY(ingredients[0].expiry_date) : "—");
    valueMap.expiry_date = `Scadenza: ${expiry}`;
    if (productMeatType === "fresh") {
      const lots = (ingredients as any[])
        .map((m) => (m?.supplier_lot ? String(m.supplier_lot).trim() : ""))
        .filter(Boolean);
      const lot = [...new Set(lots)].join(" / ") || product?.internal_lot || "—";
      valueMap.internal_lot = `Lotto: ${lot}`;
    } else {
      valueMap.internal_lot = `Lotto: ${product?.internal_lot ?? "—"}`;
    }

    const rawFields: PrintLabelField[] = tpl.layout_config?.fields ?? [];
    const visibleFields = rawFields.filter((f) => f.visible);
    const companyField = visibleFields.find((f) => f.key === "company_name");
    const addressField = rawFields.find((f) => f.key === "company_address");
    const fields: PrintLabelField[] = company?.address && companyField && !addressField
      ? [
          ...visibleFields,
          {
            key: "company_address",
            label: "Indirizzo",
            visible: true,
            x: companyField.x,
            y: companyField.y + (companyField.fontSize ?? 10) * 0.3528 * 1.35,
            fontSize: Math.min(7, Math.max(5, (companyField.fontSize ?? 10) * 0.55)),
            bold: false,
          },
        ]
      : visibleFields;

    // Misuratore per auto-shrink (stessa tecnica del layout TSPL)
    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d")!;
    const estimateLines = (text: string, pt: number, bold: boolean, widthMm: number) => {
      const px = pt * 4;
      measureCtx.font = `${bold ? "bold " : ""}${px}px Helvetica, Arial, sans-serif`;
      const widthPx = widthMm * (px / pt) / 0.3528;
      const words = text.split(/\s+/);
      let lines = 1;
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (measureCtx.measureText(test).width > widthPx && cur) {
          lines++; cur = w;
        } else cur = test;
      }
      return lines;
    };

    const renderField = (f: PrintLabelField) => {
      if (f.key === "logo") {
        if (!company?.logo_url) return "";
        const w = f.width ?? 25;
        const h = f.height ?? 15;
        const yClamp = Math.min(f.y, Math.max(0, hMm - h));
        return `<img src="${escapeHtml(company.logo_url)}" style="position:absolute;left:${f.x}mm;top:${yClamp}mm;width:${w}mm;height:${h}mm;object-fit:contain;" />`;
      }
      const text = valueMap[f.key] ?? "";
      const isAddressUnderCompany = f.key === "company_address" && companyField;
      const xMm = isAddressUnderCompany ? companyField.x : f.x;
      const yMm = isAddressUnderCompany
        ? companyField.y + (companyField.fontSize ?? f.fontSize ?? 10) * 0.3528 * 1.35
        : f.y;
      const remainingW = Math.max(5, wMm - xMm - 1);
      // Cap font for long fields (ingredients/address) so non rimangano enormi
      // su etichette piccole. L'utente può comunque ridurre dal template.
      let pt = f.fontSize;
      if (f.key === "ingredients" || f.key === "company_address") {
        const cap = Math.max(5, Math.round(hMm * 0.14));
        pt = Math.min(pt, cap);
        if (f.key === "company_address") pt = Math.min(pt, 7);
        // Auto-shrink se occupa più di ~45% dell'altezza etichetta
        const maxHmm = Math.max(6, hMm * 0.45);
        let lines = estimateLines(text, pt, f.bold, remainingW);
        while (pt > 5 && lines * (pt * 0.3528 * 1.2) > maxHmm) {
          pt -= 0.5;
          lines = estimateLines(text, pt, f.bold, remainingW);
        }
      }
      // Clamp Y dentro l'etichetta (in caso di template default oversize)
      const yClamp = Math.min(yMm, Math.max(0, hMm - pt * 0.3528 * 1.3));
      const style = `position:absolute;left:${xMm}mm;top:${yClamp}mm;width:${remainingW}mm;font-size:${pt}pt;font-weight:${f.bold ? 700 : 400};line-height:1.2;word-break:break-word;white-space:normal;overflow:hidden;`;
      return `<div style="${style}">${escapeHtml(text)}</div>`;
    };
    const labelHtml = fields.map(renderField).join("");
    const labelsHtml = Array.from({ length: labelQty })
      .map(
        () =>
          `<div class="label" style="position:relative;width:${wMm}mm;height:${hMm}mm;overflow:hidden;page-break-after:always;">${labelHtml}</div>`,
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etichetta</title>
<style>
  @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: Helvetica, Arial, sans-serif; color: #000; }
  .label { box-sizing: border-box; }
  @media screen {
    body { padding: 12px; background: #f5f5f5; }
    .label { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15); margin: 0 auto 12px; }
    .actions { position: fixed; top: 8px; right: 8px; display: flex; gap: 8px; z-index: 10; }
    .actions button { padding: 10px 16px; font-size: 14px; border: 0; border-radius: 8px; background: #0a7; color: #fff; }
  }
  @media print {
    .actions { display: none !important; }
    body { padding: 0; background: #fff; }
    .label { box-shadow: none; margin: 0; }
  }
</style></head>
<body>
<div class="actions"><button onclick="window.print()">Stampa</button></div>
${labelsHtml}
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;

    // Open in a new tab — works on both desktop and mobile, lets the system print menu open.
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      // Fallback: data URL navigation (mobile popup-blocked case)
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
    }
    setShowLabelDialog(false);
  }

  // ---------- Bluetooth printing (CLABEL 221D / TSPL) ----------

  // Common BLE service/characteristic UUIDs used by thermal label printers
  // (CLABEL 221D, Xprinter, many TSPL/ESC-POS printers expose a generic
  // "Nordic UART"–style serial profile under one of these UUIDs).
  const BT_SERVICE_UUIDS = [
    "000018f0-0000-1000-8000-00805f9b34fb",
    "0000ff00-0000-1000-8000-00805f9b34fb",
    "0000ffe0-0000-1000-8000-00805f9b34fb",
    "49535343-fe7d-4ae5-8fa9-9fafd205e455",
    "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  ];

  function strToBytes(s: string) {
    // CLABEL/TSPL uses CP437/Latin1 for accented chars in Italian.
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }

  function concatBytes(chunks: Uint8Array[]) {
    const len = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  }

  // Carica un'immagine in modo asincrono per renderizzarla su canvas
  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  // Renderizza l'etichetta su un canvas monocromatico alla risoluzione
  // esatta della stampante (CLABEL CT221D = 203 dpi = 8 dots/mm) in modo
  // che la stampa sia identica al pixel rispetto al preview.
  async function buildTSPL(): Promise<Uint8Array> {
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
    if (!tpl) throw new Error("Template non selezionato");
    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);
    const items = computeLabelLayout(wMm, hMm);

    const DPMM = 8; // 203 dpi
    const widthDots = Math.round(wMm * DPMM);
    const heightDots = Math.round(hMm * DPMM);

    // 1 pt = 1/72 inch = 203/72 dots ≈ 2.819 dots
    const ptToDots = (pt: number) => pt * (203 / 72);
    const mmToDots = (mm: number) => mm * DPMM;

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

    // Disegno parole con wrap; ritorna y finale
    const drawWrapped = (
      segments: { text: string; bold: boolean }[],
      xStart: number,
      yStart: number,
      maxWidth: number,
      lineHeight: number,
      px: number,
    ) => {
      // Espandi parole preservando il flag bold per ogni parola
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
      const spaceW = (() => {
        setFont(px, false);
        return ctx.measureText(" ").width;
      })();

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
      return y + lineHeight;
    };

    // Disegno layout fisso
    for (const it of items) {
      const x = mmToDots(it.x);
      const y = mmToDots(it.y);
      const px = ptToDots(it.fontPt);
      const lineHeight = px * it.lineHeight;
      const maxWidth = mmToDots(it.w);

      if (it.align === "left") {
        drawWrapped(it.segments, x, y, maxWidth, lineHeight, px);
      } else {
        // Allineamento single-line: misuro larghezza totale e calcolo offset
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

    // Conversione canvas → bitmap monocromatica (1 bpp, MSB-first, 0=black)
    const imgData = ctx.getImageData(0, 0, widthDots, heightDots);
    const widthBytes = Math.ceil(widthDots / 8);
    const bitmap = new Uint8Array(widthBytes * heightDots);
    bitmap.fill(0xff); // tutto bianco
    for (let py = 0; py < heightDots; py++) {
      for (let px2 = 0; px2 < widthDots; px2++) {
        const i = (py * widthDots + px2) * 4;
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        const a = imgData.data[i + 3];
        // Luminance threshold; pixel "scuro" → bit 0 (black)
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) * (a / 255) + 255 * (1 - a / 255);
        if (lum < 160) {
          const byteIdx = py * widthBytes + (px2 >> 3);
          const bit = 7 - (px2 & 7);
          bitmap[byteIdx] &= ~(1 << bit);
        }
      }
    }

    // Composizione comando TSPL: header testuale + BITMAP + dati binari + footer
    const enc = new TextEncoder();
    const header = enc.encode(
      [
        `SIZE ${wMm} mm,${hMm} mm`,
        `GAP 2 mm,0 mm`,
        `DIRECTION 1`,
        `CLS`,
        `BITMAP 0,0,${widthBytes},${heightDots},0,`,
      ].join("\r\n") + "",
    );
    // La riga BITMAP termina dopo la virgola: i dati binari seguono direttamente
    // (così come da specifica TSPL), poi CRLF e PRINT.
    const footer = enc.encode(`\r\nPRINT ${labelQty},1\r\n`);

    const total = new Uint8Array(header.length + bitmap.length + footer.length);
    total.set(header, 0);
    total.set(bitmap, header.length);
    total.set(footer, header.length + bitmap.length);
    return total;
  }

  async function findWritableCharacteristic(server: any) {
    for (const uuid of BT_SERVICE_UUIDS) {
      try {
        const svc = await server.getPrimaryService(uuid);
        const chars = await svc.getCharacteristics();
        const c = chars.find((ch) => ch.properties.write || ch.properties.writeWithoutResponse);
        if (c) return c;
      } catch { /* try next */ }
    }
    // Fallback: scan all primary services
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      const c = chars.find((ch) => ch.properties.write || ch.properties.writeWithoutResponse);
      if (c) return c;
    }
    throw new Error("Nessuna caratteristica scrivibile trovata sulla stampante");
  }

  async function printLabelBluetooth() {
    if (!product) return;
    if (!selectedTemplate) { toast.error("Seleziona un template"); return; }
    const nav: any = navigator;
    if (!nav?.bluetooth) {
      toast.error("Web Bluetooth non supportato. Usa Chrome/Edge su Android o desktop.");
      return;
    }
    if (!window.isSecureContext) {
      toast.error("Bluetooth bloccato: apri l'app dal link pubblicato HTTPS, non da una pagina incorporata.");
      return;
    }
    if (document.visibilityState !== "visible") {
      toast.error("Bluetooth bloccato: riapri la pagina in primo piano e premi di nuovo il pulsante.");
      return;
    }

    let device: any;
    try {
      // Deve essere la prima operazione asincrona dopo il tap: su Android
      // altrimenti Chrome può bloccare il selettore senza mostrarlo.
      device = await nav.bluetooth.requestDevice({
        // Show all devices so any CLABEL 221D variant is selectable
        acceptAllDevices: true,
        optionalServices: BT_SERVICE_UUIDS,
      });
      setBtPrinting(true);
      if (!device.gatt) {
        throw new Error("La stampante è stata vista dal telefono ma non espone Bluetooth BLE/GATT: Chrome può stampare solo su dispositivi BLE, non tramite semplice associazione Android.");
      }
      toast.message(`Connessione a ${device.name ?? "stampante"}…`);
      const server = await device.gatt.connect();
      const ch = await findWritableCharacteristic(server);

      const data = await buildTSPL();
      // Strategia ibrida ad alta velocità:
      // - chunk grandi (100 byte) via writeWithoutResponse (veloce, no ack)
      // - ogni N chunk un writeValue con response come "barriera" di flow-control
      //   (svuota la coda BLE evitando pacchetti persi su Android)
      // Risultato: ~5–10x più veloce di solo write-with-response, mantenendo
      // affidabilità su Android.
      const isAndroid = /Android/i.test(navigator.userAgent);
      // Su Android serve un buon margine: chunk più piccoli e barriere
      // di flow-control più frequenti per evitare pacchetti persi.
      const CHUNK = isAndroid ? 60 : 100;
      const SYNC_EVERY = isAndroid ? 4 : 16;
      const supportsWoR = ch.properties.writeWithoutResponse;
      const supportsWithR = ch.properties.write;
      toast.message(`Invio ${data.length} byte alla stampante…`);
      let chunkIdx = 0;
      for (let i = 0; i < data.length; i += CHUNK) {
        const slice = data.slice(i, i + CHUNK);
        const isLast = i + CHUNK >= data.length;
        const isSyncPoint = (chunkIdx + 1) % SYNC_EVERY === 0 || isLast;
        if (supportsWoR && !isSyncPoint) {
          await ch.writeValueWithoutResponse(slice);
        } else if (supportsWithR) {
          await ch.writeValue(slice);
        } else {
          await ch.writeValueWithoutResponse(slice);
        }
        chunkIdx++;
      }
      toast.success("Etichetta inviata alla stampante");
      try { device.gatt.disconnect(); } catch { /* ignore */ }
      setShowLabelDialog(false);
    } catch (e: any) {
      console.error("[BT print]", e);
      const name = e?.name ?? "";
      if (name === "NotFoundError") {
        toast.error("Stampante non selezionata in Chrome: l'associazione nelle impostazioni Android non basta. Tieni accesa la CLABEL vicino al telefono, attiva Bluetooth e Posizione, poi scegli la stampante nella finestra che si apre.");
      } else if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error("Chrome ha bloccato la scelta dispositivo: abilita permessi Bluetooth/Posizione per questo sito e riprova.");
      } else {
        toast.error(e?.message ?? "Errore stampa Bluetooth");
      }
    } finally {
      setBtPrinting(false);
    }
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

  function printLabelA5() {
    if (!product) return;
    const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
    if (!tpl) { toast.error("Seleziona un template"); return; }
    const wMm = Number(tpl.width_mm);
    const hMm = Number(tpl.height_mm);
    const items = computeLabelLayout(wMm, hMm);
    const pageW = 148, pageH = 210, margin = 12;
    const scale = Math.min((pageW - 2 * margin) / wMm, (pageH - 2 * margin) / hMm);
    const scaledW = wMm * scale;
    const scaledH = hMm * scale;

    const escapeHtml = (s: string) =>
      String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

    const itemsHtml = items.map((it) => {
      const segs = it.segments
        .map((s) => `<span style="font-weight:${s.bold ? 700 : 400}">${escapeHtml(s.text)}</span>`)
        .join("");
      return `<div style="position:absolute;left:${it.x}mm;top:${it.y}mm;width:${it.w}mm;font-size:${it.fontPt}pt;line-height:${it.lineHeight};text-align:${it.align};word-break:break-word;overflow:hidden;">${segs}</div>`;
    }).join("");

    const headerHtml = `
      <div style="position:absolute;left:${margin}mm;top:${margin}mm;right:${margin}mm;font-size:9pt;color:#444;border-bottom:1px solid #ccc;padding-bottom:3mm;">
        <div style="font-weight:700;font-size:11pt;color:#000;">${escapeHtml(company?.business_name ?? "")}</div>
        <div>${escapeHtml(product?.name ?? "")} — Lotto ${escapeHtml(product?.internal_lot ?? "")}</div>
      </div>`;
    const labelTopMm = margin + 14;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etichetta A5 — ${escapeHtml(product?.name ?? "")}</title>
<style>
  @page { size: A5 portrait; margin: 0; }
  html, body { margin:0; padding:0; background:#fff; font-family: Helvetica, Arial, sans-serif; color:#000; }
  .page { position:relative; width:${pageW}mm; height:${pageH}mm; }
  .label-wrap { position:absolute; left:${(pageW - scaledW) / 2}mm; top:${labelTopMm}mm; width:${scaledW}mm; height:${scaledH}mm; border:1px dashed #888; box-sizing:border-box; overflow:hidden; }
  .label { position:relative; width:${wMm}mm; height:${hMm}mm; transform:scale(${scale}); transform-origin: top left; }
  @media screen {
    body { padding:12px; background:#f5f5f5; }
    .page { background:#fff; box-shadow: 0 2px 8px rgba(0,0,0,.15); margin: 0 auto; }
    .actions { position: fixed; top: 8px; right: 8px; z-index:10; }
    .actions button { padding:10px 16px; font-size:14px; border:0; border-radius:8px; background:#0a7; color:#fff; }
  }
  @media print { .actions { display:none !important; } body { padding:0; background:#fff; } }
</style></head>
<body>
<div class="actions"><button onclick="window.print()">Stampa</button></div>
<div class="page">
  ${headerHtml}
  <div class="label-wrap"><div class="label">${itemsHtml}</div></div>
</div>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 300); });</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.location.href = url;
    }
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
          <Button onClick={() => setShowLabelDialog(true)} variant="outline" className="mt-5 ml-2 gap-2">
            <Printer size={16} /> Stampa Etichetta
          </Button>
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

      <Dialog open={showLabelDialog} onOpenChange={(v) => { setShowLabelDialog(v); if (!v) setPreservationOverride(""); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stampa Etichetta</DialogTitle>
            <DialogDescription>Seleziona template e quantità, verifica l'anteprima e stampa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const deptName = (
                departments.find((d) => d.id === (product as any)?.department_id)?.name ||
                adminDeptName || ""
              ).toLowerCase().trim();
              const isSalumeria = deptName.startsWith("salum");
              if (!isSalumeria) return null;
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
                    La scadenza viene ricalcolata in tempo reale nell'anteprima qui sotto.
                  </p>
                </div>
              );
            })()}
            <div>
              <Label className="text-sm font-medium">Template etichetta</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona template" />
                </SelectTrigger>
                <SelectContent>
                  {labelTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({Number(t.width_mm)}×{Number(t.height_mm)} mm)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Quantità etichette</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={labelQty === 0 ? "" : labelQty}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") { setLabelQty(0); return; }
                  const n = parseInt(v, 10);
                  if (!isNaN(n)) setLabelQty(Math.min(100, Math.max(0, n)));
                }}
                onBlur={() => { if (!labelQty || labelQty < 1) setLabelQty(1); }}
              />
            </div>

            {/* Live preview */}
            {selectedTemplate && (() => {
              const tpl = labelTemplates.find((t: any) => t.id === selectedTemplate);
              if (!tpl) return null;
              const wMm = Number(tpl.width_mm);
              const hMm = Number(tpl.height_mm);
              const items = computeLabelLayout(wMm, hMm);
              const ptToPx = PX_PER_MM / 2.835;
              return (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Anteprima</Label>
                  <div className="border rounded-lg p-3 bg-muted/30 overflow-auto">
                    <div
                      className="relative bg-white border border-dashed border-border mx-auto"
                      style={{ width: wMm * PX_PER_MM, height: hMm * PX_PER_MM }}
                    >
                      {items.map((it, idx) => (
                        <div
                          key={idx}
                          className="absolute text-black"
                          style={{
                            left: it.x * PX_PER_MM,
                            top: it.y * PX_PER_MM,
                            width: it.w * PX_PER_MM,
                            fontSize: it.fontPt * ptToPx,
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
                    {wMm} × {hMm} mm
                  </p>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={printLabel} className="w-full gap-2">
                <Printer size={16} /> Stampa di sistema
              </Button>
              <Button onClick={printLabelBluetooth} disabled={btPrinting} variant="secondary" className="w-full gap-2">
                {btPrinting ? <Loader2 size={16} className="animate-spin" /> : <Bluetooth size={16} />}
                Stampa Etichetta Bluetooth
              </Button>
              <Button onClick={printLabelA5} variant="outline" className="w-full gap-2 sm:col-span-2">
                <FileText size={16} /> Stampa report A5 (etichetta ingrandita)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Il pulsante Bluetooth richiede Chrome/Edge e la selezione della stampante nella finestra del browser: l'associazione nelle impostazioni Android non equivale a connessione per l'app.
            </p>
          </div>
        </DialogContent>
      </Dialog>

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