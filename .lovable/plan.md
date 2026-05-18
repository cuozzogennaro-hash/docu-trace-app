# Sezione "Logiche etichette" per reparto

## Obiettivo
Una nuova scheda in **Impostazioni → Logiche etichette** che raccoglie, raggruppate per reparto, tutte le regole oggi applicate alle etichette. L'admin può consultarle e modificare i parametri principali (testi avvisi, giorni di scadenza, elenco allergeni, ecc.). Le modifiche vengono lette in tempo reale dalla pagina di stampa etichetta.

## Struttura della scheda
Layout a sezioni (una per reparto) con card editabili. Ogni card mostra: **titolo della regola**, **descrizione** (cosa fa) e — se previsto — **parametri** modificabili.

### Comuni (tutti i reparti)
- **Allergeni evidenziati** — interruttore on/off + elenco parole chiave (chip modificabili). Default: i 14 allergeni di legge.
- **Additivi (sigle E…)** — in etichetta vengono stampate solo le sigle (es. E250) in grassetto, non il nome commerciale.
- **Intestazione azienda** — Ragione sociale + Indirizzo (via — città) sempre in alto.

### Macelleria – Carne Fresca
- **Avviso conservazione** — testo modificabile (default: "Conservare da 0° e +4° — Consumare previa cottura").
- **Lotto stampato** — usa il lotto del fornitore, non il lotto interno.
- **Tracciabilità** — righe Nato / Allevato / Macellato + Bollo CE, prese dalla materia prima.
- **Ingredienti** — non stampati (carne fresca monocomponente).

### Macelleria – Preparato
- **Avviso conservazione** — testo modificabile.
- **Origine carne** — formula "Carne origine: IT" se tutte le materie prime italiane, altrimenti "UE".
- **Ingredienti** — elenco con "carne di <specie> (origine)" + altri.

### Salumeria
- **Scadenza automatica** — giorni da data produzione (default 30, modificabile).
- **Composizione ingredienti** — nome del prodotto seguito dai suoi sotto-ingredienti tra parentesi.

### Ortofrutta / Default
- **Formato standard** — intestazione + prodotto + ingredienti + data produzione + lotto + scadenza.

## Modello dati
Nuova tabella `label_rules` (per utente):
- `department_key` (common / macelleria_fresh / macelleria_preparato / salumeria / ortofrutta)
- `rule_key`, `title`, `description`, `params jsonb`, `sort_order`
- RLS: ognuno vede e modifica solo le proprie regole
- Trigger che pre-popola le regole standard alla creazione del profilo
- Seed immediato per gli utenti già esistenti

## Lettura runtime
In `ProductDetail.tsx` (e nelle altre pagine di stampa) i valori hardcoded oggi presenti vengono sostituiti dalla lettura dei parametri:
- giorni shelf-life Salumeria → `salumeria.shelf_life.days`
- testo avvisi Macelleria → `macelleria_*.notice.text`
- elenco allergeni evidenziati → `common.allergens.keywords` (fallback alla lista attuale se vuoto)

Le regole strutturali (es. "in Macelleria Fresca si stampa il lotto fornitore") restano nel codice ma sono **descritte e documentate** nella card, così l'utente sa esattamente cosa fa il sistema in ogni reparto.

## File modificati / nuovi
- `supabase/migrations/...` — tabella `label_rules` + RLS + trigger di seed
- seed via insert per gli utenti esistenti
- `src/hooks/useLabelRules.tsx` — nuovo hook di lettura
- `src/components/settings/LabelRulesTab.tsx` — nuovo tab
- `src/pages/Settings.tsx` — registrazione del tab
- `src/pages/ProductDetail.tsx` — consumo dei parametri configurabili
