# Allergeni: scheda dedicata e separata dagli additivi

## Obiettivo

Oggi additivi e allergeni condividono la stessa categoria "Additivo / Allergene" dentro le materie prime, quindi vengono trattati come merce in ingresso (con lotto, scadenza, fornitore, ecc.). Risultato: la scheda è caotica e gli allergeni sono "gonfiati" di dati che non servono.

Vogliamo che gli allergeni diventino una **semplice anagrafica di riferimento**: una lista consultabile e aggiornabile dall'admin, usata solo per evidenziare in grassetto le parole allergeniche dentro la lista ingredienti dell'etichetta. Niente lotti, scadenze, fornitori, ingressi merce.

## Soluzione proposta

### 1. Nuova tabella `allergens` (anagrafica pura)

Campi minimi:
- `name` (es. "Glutine", "Latte", "Solfiti") — nome principale
- `keywords` (lista di parole/derivati da cercare nell'elenco ingredienti, es. per Glutine: grano, frumento, segale, orzo, farro)
- `notes` (facoltativo)
- gestione standard utente/timestamp

Seed automatico con i 14 allergeni del Reg. UE 1169/2011 (glutine, crostacei, uova, pesce, arachidi, soia, latte, frutta a guscio, sedano, senape, sesamo, solfiti, lupini, molluschi) con le keyword già pronte (riprese dall'elenco che oggi è hard-coded in `ProductDetail.tsx` e in `seed_label_rules_for_user`).

### 2. Nuova scheda "Allergeni" in Impostazioni

Tab dedicato accanto a "Ingredienti ricorrenti" e "Logiche etichette":
- Tabella con Nome + Keywords (chip), pulsante Modifica / Elimina
- Pulsante "Aggiungi allergene" con form semplice (nome + keywords separate da virgola)
- Solo admin

### 3. Pulizia della categoria "Additivo / Allergene"

- Rinominata in **"Additivo"** ovunque (Ingresso merce, Produzione, scheda materia prima, Ingredienti ricorrenti)
- La categoria interna `additivo_allergene` resta a livello DB per non rompere i dati esistenti, ma in UI compare solo come "Additivo"
- Le materie prime già inserite come allergene puro (es. "Solfiti") continuano a funzionare; l'admin potrà cancellarle quando vuole, perché ora gli allergeni vivono nella nuova scheda

### 4. Etichetta: la logica esistente diventa data-driven

- `ProductDetail.tsx` non legge più la lista hard-coded né i keyword dentro `label_rules`, ma la **nuova tabella `allergens`** (unione di tutte le keywords) per costruire la regex di grassetto
- La regola "Evidenziazione allergeni" in *Logiche etichette* viene aggiornata: descrizione che rimanda alla nuova scheda Allergeni come fonte unica delle parole evidenziate (niente più keyword duplicate dentro `params`)

## File coinvolti

- Migrazione DB: nuova tabella `allergens` + RLS + seed dei 14 allergeni di legge per ogni utente esistente, trigger di seed per nuovi utenti
- `src/components/settings/AllergensTab.tsx` (nuovo)
- `src/hooks/useAllergens.tsx` (nuovo)
- `src/pages/Settings.tsx` (nuovo tab)
- `src/pages/ProductDetail.tsx` (legge keywords dalla nuova tabella)
- `src/components/settings/LabelRulesTab.tsx` e seed di `label_rules`: aggiornata la descrizione della regola allergens; rimossa l'editing delle keywords
- `src/pages/Incoming.tsx`, `src/pages/Production.tsx`, `src/components/settings/IngredientsTab.tsx`, `src/components/settings/RecurringTab.tsx`: etichetta "Additivo / Allergene" → "Additivo"

## Cosa NON cambia

- I prodotti già etichettati continuano a stamparsi identici
- Le materie prime esistenti restano intatte
- Le regole per reparto restano modificabili dall'admin come oggi
