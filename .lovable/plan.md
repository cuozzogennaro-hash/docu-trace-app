# Moduli Cucina / Ristorazione

Aggiungiamo un set di funzioni HACCP pensate per ristoranti, pizzerie e attività miste, **senza toccare** le logiche di etichette / lotti / reparti già in produzione.

Le nuove voci compariranno nella sidebar solo per i profili `ristorazione` e `misto`, raggruppate sotto un nuovo gruppo **"Cucina"**. Il profilo `laboratorio` non vede nulla di nuovo.

## Fase 1 — Le due funzioni più richieste (questa sessione)

### 1. Abbattimenti (`/abbattimenti`)
Registro digitale degli abbattimenti rapidi (HACCP obbligatorio per chi serve crudo, sushi, prepara in anticipo, ecc.).

Per ogni ciclo:
- Prodotto / preparazione
- Operatore (dalla sessione operatore)
- Attrezzatura abbattitore (dagli `assets`, nuovo `asset_type = 'abbattitore'`)
- Temperatura inizio / fine
- Ora inizio / ora fine (durata calcolata)
- Tipo ciclo: positivo (+3°C) / negativo (-18°C)
- Esito (OK / Anomalia + note)
- Stampa etichetta abbattimento (riusa il sistema etichette esistente, nuovo template "Abbattimento")

### 2. Mise en place / Preparati interni (`/preparati`)
Etichette per semilavorati interni con scadenza interna calcolata.

Per ogni preparato:
- Nome preparazione
- Data + ora preparazione
- Scadenza interna (default configurabile per tipo: salse 48h, verdure cotte 72h, ecc.)
- Operatore
- Allergeni (multi-select dalla tabella `allergens` esistente)
- Conservazione (frigo / freezer / ambiente)
- Note
- Stampa etichetta (nuovo template "Mise en place")

## Fase 2 — Successiva (non in questa sessione)
- Allergeni sul menu (piatti con calcolo automatico da ingredienti)
- Conservazione / rigenerazione (ciclo cottura → raffreddamento → rigenerazione)
- Controllo olio friggitrice (TPM)
- Non conformità / reclami

## Dettagli tecnici

### Database — nuove tabelle

```text
blast_chillings           preparations
──────────────────       ──────────────────
id                        id
user_id                   user_id
product_name              name
operator_id               operator_id
asset_id (abbattitore)    prepared_at (timestamptz)
cycle_type (pos|neg)      internal_expiry (timestamptz)
temp_start, temp_end      storage_type (frigo|freezer|ambiente)
started_at, ended_at      allergen_ids (uuid[])
outcome (ok|anomaly)      notes
notes                     created_at
created_at
```

Entrambe con RLS `auth.uid() = user_id`, stesso pattern delle tabelle esistenti.

### Etichette
Aggiungiamo due **nuovi template** in `label_templates` come opzioni selezionabili; **non modifichiamo** il template default né le `label_rules` esistenti. La stampa riusa esattamente il flusso già in uso (`LabelEditorTab` / printer pipeline).

### Sidebar
Nuovo gruppo "Cucina" in `AppShell.tsx` con due voci. Aggiornata `NAV_VISIBILITY` in `useActivityProfile.tsx`:
- `laboratorio`: invariato (non vede il gruppo)
- `ristorazione`: vede solo Cucina + HACCP + Magazzino base + Sistema
- `misto`: vede tutto, incluso Cucina

### File nuovi
- `src/pages/BlastChillings.tsx`
- `src/pages/Preparations.tsx`
- `src/hooks/useBlastChillings.tsx`
- `src/hooks/usePreparations.tsx`
- Route aggiunte in `src/App.tsx`

### File modificati (minimi)
- `src/components/AppShell.tsx` — nuovo gruppo nav
- `src/hooks/useActivityProfile.tsx` — aggiunte rotte a `NAV_VISIBILITY`
- `src/App.tsx` — due nuove route

**Non toccati**: `LabelEditorTab`, `LabelRulesTab`, `useLabelRules`, `lib/lot.ts`, tabelle `products` / `raw_materials` / `label_rules` / `label_templates` esistenti.