# Gestione Scadenze

Sistema unificato per monitorare e agire sulle scadenze di materie prime, prodotti finiti e preparazioni.

## 1. Nuova pagina "Scadenze" (`/scadenze`)

Vista aggregata con tab/filtri per urgenza:
- **Scadute** (data < oggi) — rosso
- **Oggi / Domani** — arancio
- **Entro 3 giorni** — giallo
- **Entro 7 giorni** — verde
- **Tutte**

Tabella unica con colonne: Tipo (Materia prima / Prodotto / Preparazione), Reparto, Nome, Lotto, Data scadenza, Giorni rimanenti, Azioni.

Filtri rapidi: per reparto, per tipo.

**Fonti dati:**
- `raw_materials.expiry_date` (escluse `is_out_of_stock = true`)
- `products` → scadenza calcolata da `production_date + preservation_type` usando le regole `label_rules` (`salumeria.shelf_life`: `days_fresh` / `days_vacuum`)
- `preparations.internal_expiry`

## 2. Filtro ingredienti scaduti nella creazione prodotti

In `Production.tsx` (creazione nuovo prodotto), oltre al filtro `is_out_of_stock` già presente, escludere le materie prime con `expiry_date < oggi`. Le scadute non compaiono nella lista ingredienti selezionabili.

Stesso filtro applicato anche in `Preparations.tsx` se selezionano materie prime.

Mantenute visibili nell'Archivio (per storico/tracciabilità), ma marcate visivamente come scadute.

## 3. Badge e indicatori

- Voce sidebar **"Scadenze"** con badge rosso contatore (scadute + in scadenza oggi)
- Card riepilogo nella Dashboard principale: "X scadute · Y in scadenza oggi"
- Nell'Archivio Materie Prime e Prodotti: pallino colorato a sinistra della riga (rosso/arancio/verde) in base allo stato scadenza

## 4. Azioni rapide su ogni riga scadenza

- **Segna fuori stock** → `UPDATE raw_materials SET is_out_of_stock = true` (campo già esistente)
- **Crea non-conformità** (solo se scaduta e ancora attiva) → inserisce in `non_conformities` con `area='scadenza'`, severity automatica, titolo precompilato
- **Apri dettaglio** → link a `RawMaterialDetail` / `ProductDetail`

## 5. Configurazione (opzionale, in Impostazioni)

Soglie di alert configurabili per utente (default 7 giorni). Per ora hardcoded, eventuale `company_settings.expiry_alert_days` in seconda fase.

---

## Dettagli tecnici

**File da creare:**
- `src/pages/Expiries.tsx` — pagina principale
- `src/lib/expiry.ts` — utility `computeExpiryDate(product, rules)`, `getExpiryStatus(date)` → `'expired' | 'today' | 'soon' | 'week' | 'ok'`

**File da modificare:**
- `src/App.tsx` — route `/scadenze`
- `src/components/AppShell.tsx` — voce sidebar + badge contatore (query leggera count)
- `src/pages/Dashboard.tsx` — card riepilogo
- `src/pages/Production.tsx` — aggiungere `.gt("expiry_date", today)` o filtro client-side `r.expiry_date >= today || !r.expiry_date` nella selezione ingredienti (riga ~89 e ~94)
- `src/pages/Preparations.tsx` — stesso filtro
- `src/pages/Archive.tsx` — pallino stato scadenza nelle righe
- `src/i18n/dict.ts` — chiavi IT/EN per la nuova UI

**Database:** nessuna migrazione necessaria, tutti i campi esistono già (`expiry_date`, `internal_expiry`, `is_out_of_stock`, `preservation_type`, `label_rules` con `days_fresh`/`days_vacuum`).

**Niente edge function / push** in questa fase — eventuale fase 2.
