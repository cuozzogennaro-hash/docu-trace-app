# Unificazione stampa etichette: `TemplatedLabelDialog`

## Obiettivo
Una sola pipeline di rendering etichette (template grafico dell'editor + TSPL/Phomemo/Web/A5) usata da Archivio, Cucina (Preparati), Abbattimenti. Eliminare `PrintLabelDialog` "semplificato".

## Scelta progettuale chiave: input normalizzato

Il motore etichetta di `ProductDetail` lavora oggi su `product + ingredients[]` e ricava da lì tutti i campi (`product_name`, `internal_lot`, `production_date`, `expiry_date`, `ingredients`). I callsite Cucina/Abbattimenti **non hanno una riga `products`**: hanno `Preparation` o `BlastChilling`.

Approccio: il nuovo componente accetta un **`LabelData` già pronto** (i campi semantici già mappati), non `product+ingredients`. La logica di composizione "ingredienti complessi" (regole Salumeria/Macelleria/Cucina, allergeni canonici, tracciabilità carne, deduplica) resta esclusiva del flusso prodotto e viene preparata dal chiamante. Per Cucina/Abbattimenti basta passare i campi testuali già pronti — è quello che fanno oggi.

## Nuovo componente

`src/components/labels/TemplatedLabelDialog.tsx`

Props:
```ts
{
  open, onOpenChange,
  data: {
    productName: string;
    companyName?: string; companyAddress?: string;
    productionDate?: string;   // GG/MM/AA
    expiryDate?: string;       // testo libero "Da consumarsi entro..." o data
    internalLot?: string;
    ingredientsText?: string;  // già composto + allergeni evidenziabili
    extraLines?: string[];     // tracciabilità, conservazione, note
    allergensLine?: string;
  },
  highlightAllergens?: string[]; // keywords per il grassetto inline
  templates: LabelTemplate[];    // caricati dal chiamante
  defaultQty?: number;
}
```

Internamente espone: select template + qty, preview live, stampa di sistema (web), stampa BT (TSPL/Phomemo via `buildTSPL`/`buildPhomemoLabel` come oggi), stampa A5.

## Refactor `ProductDetail.tsx`

1. Estrarre in `src/lib/labelLayout.ts` (puro, no React):
   - `formatDateDDMMYY`
   - `computeLabelLayout(data, wMm, hMm)` → ritorna `LabelItem[]`
   - `renderLabelCanvas(items, tpl, dpmm)` → canvas mono
   - `canvasToMonoBitmap`, `buildTSPLBytes`, `buildPhomemoBytes`
2. `ProductDetail.tsx` mantiene solo: caricamento `labelTemplates`, composizione del `LabelData` (con tutta la logica Salumeria/Macelleria/Cucina/allergeni già esistente), poi monta `<TemplatedLabelDialog data={...} templates={...} />`.
3. Mantenute: `preservationOverride` (Salumeria), `selectedTemplate`, `labelQty` (passati come stato interno del dialog), comportamento bottoni invariato.

## Sostituzioni Cucina

`src/pages/Preparations.tsx`:
- Caricare `label_templates` (nuovo hook leggero `useLabelTemplates` o query in pagina).
- Compone `LabelData` da `Preparation`:
  - `productName = printItem.name`
  - `productionDate = formatDateDDMMYY(printItem.prepared_at)`
  - `expiryDate` = testo dinamico già esistente per `storage_type` (frigo/freezer/ambiente) + data
  - `extraLines` = riga conservazione + eventuale note
  - `ingredientsText` = combinazione raw materials + `ingredients_text` (come oggi)
  - `highlightAllergens` = `allergenNames` (già calcolato)
- Sostituire `<PrintLabelDialog ... />` con `<TemplatedLabelDialog ... />`.

`src/pages/BlastChillings.tsx`:
- Stessa cosa: `productName` dal record, `productionDate` = inizio ciclo, `extraLines` con tipo ciclo/temperature/durata.

## Rimozione

- `src/components/kitchen/PrintLabelDialog.tsx` → eliminato.
- `buildLabelBytes` in `src/lib/btPrinter.ts` → eliminato (sostituito da TSPL/Phomemo raster).

## File toccati

- nuovo `src/lib/labelLayout.ts` (~600 righe estratte)
- nuovo `src/components/labels/TemplatedLabelDialog.tsx`
- nuovo `src/hooks/useLabelTemplates.tsx`
- modificato `src/pages/ProductDetail.tsx` (rimossi ~700 righe di rendering)
- modificato `src/pages/Preparations.tsx`
- modificato `src/pages/BlastChillings.tsx`
- modificato `src/lib/btPrinter.ts` (rimosso `buildLabelBytes`)
- eliminato `src/components/kitchen/PrintLabelDialog.tsx`

## Rischi e mitigazioni

- **Regressione layout prodotto**: il refactor sposta codice senza modificarne il comportamento. Mitigato testando manualmente una stampa Archivio dopo il refactor (preview identica).
- **Cucina senza regole speciali**: i Preparati non hanno `product.department_id` né ingredienti tracciati come `raw_materials`, quindi la loro stampa userà solo `productName + ingredientsText + extraLines` sul template grafico — niente tracciabilità carne / allergeni canonici DB. Gli allergeni configurati sul Preparato restano evidenziati via `highlightAllergens`.
- **`buildLabelBytes` rimosso**: non più usato da nessuno dopo la sostituzione.

## Conferma richiesta

Procedo con questa architettura? In particolare: confermi che per Cucina/Abbattimenti il template grafico viene "riempito" con i campi base (nome, data, scadenza, lotto se presente, ingredienti, note) **senza** applicare la logica composita Salumeria/Macelleria — che resta esclusiva di Archivio prodotti?
