
# Integrazione reparto "Cucina"

Obiettivo: trattare la **Cucina** come un reparto a tutti gli effetti per chi sceglie profilo *Ristorazione* o *Misto*, riusando le schermate esistenti senza duplicare voci di menu.

## 1. Profilo attività e sidebar

- Quando il profilo è `ristorazione` o `misto`, garantire che esista (auto-seed se mancante) un **department** chiamato "Cucina" per l'utente.
- **Sidebar** (`NAV_VISIBILITY` in `useActivityProfile.tsx`):
  - `ristorazione`: rimuovere voci doppione (`/preparati`, `/mantenimento`, `/abbattimenti`, `/frittura` resteranno raggiungibili dall'archivio o da "Lavorazioni"); mostrare un'unica voce **Lavorazioni** (= `/produzione`) e **Archivio**, **Ingresso merci**, **Sanificazione**, **Temperature**, **Menu**, **Non conformità**, **Report**, **Impostazioni**.
  - `misto`: stessa logica anti-ridondanza.
  - `laboratorio`: invariato.
- Etichetta dinamica voce sidebar:
  - "Produzione" → **"Lavorazioni"** per tutti i profili (rename globale).
  - In profilo `ristorazione` mostrare l'etichetta come **"Ricette"**.
- "Prodotti ricorrenti" → **"Lavorazioni ricorrenti"** (e **"Ricette ricorrenti"** in ristorazione).

## 2. Archivio

- Aggiungere automaticamente la card/sezione **Cucina** nell'archivio quando esiste il department Cucina.
- I prodotti/ricette creati con `department_id = Cucina` ricadono lì, esattamente come Macelleria/Salumeria.

## 3. Ingresso merci + Non Conformità fornitore

- Nel form di ingresso, se reparto = Cucina, mostrare campo **Temperatura di ingresso (°C)** (nuova colonna `intake_temperature numeric` su `raw_materials`).
- Aggiungere campo `intake_temp_compliant boolean` (calcolato o impostato manualmente con soglia di default: ≤4°C refrigerato, ≤−18°C surgelato — chiediamo all'utente o usiamo default editabile).
- Se non conforme → pulsante **"Apri contestazione fornitore"** che precompila una `non_conformities` con `area='fornitore'`, titolo, descrizione, e link al raw_material.
- Le contestazioni restano consultabili nel registro `/non-conformita` (già esistente).

## 4. Lavorazioni / Ricette

Riusare `products` + `product_ingredients`. Aggiunte:

- Nuova colonna `requires_blast_chilling boolean default false` su `products`.
- Nuova colonna `manual_ingredients text` per ingredienti scritti a mano (oltre a `raw_material_ids`).
- Nel form di creazione:
  - Flag **"Richiede abbattimento / conservazione speciale"**.
  - Se attivo → al salvataggio creare automaticamente una riga in `blast_chillings` (stato "da completare") collegata, e mostrare CTA "Completa abbattimento" → porta a `/abbattimenti` precompilato.
- Ingredienti: selezione da `raw_materials` **oppure** testo libero (`manual_ingredients`).
- Etichetta del bottone/pagina cambia in base al profilo (Lavorazione / Ricetta).

## 5. Etichette per Cucina

- Le ricette di Cucina seguono le regole **macelleria_preparato** (multi-prodotto): elenco ingredienti completo, allergeni in grassetto, additivi E…, conservazione configurabile.
- Aggiungere chiave `cucina` in `label_rules` con seed identico a `macelleria_preparato` (modificabile poi dall'utente).

## 6. Report / Stampa PDF

- Estendere il generatore PDF in `/report` per includere sezione **Cucina** quando profilo = ristorazione/misto, con:
  - report singolo (per ricetta / abbattimento / contestazione)
  - report mensile generale
- Riusare i componenti PDF esistenti (stessa libreria/route).

## Dettagli tecnici (riassunto migrazioni)

```text
ALTER TABLE raw_materials
  ADD COLUMN intake_temperature numeric,
  ADD COLUMN intake_temp_compliant boolean;

ALTER TABLE products
  ADD COLUMN requires_blast_chilling boolean NOT NULL DEFAULT false,
  ADD COLUMN manual_ingredients text;

-- seed dept "Cucina" per utenti con profilo risto/misto (lato client, non DB)
-- seed label_rules department_key='cucina' clonando macelleria_preparato
```

Nessuna modifica a tabelle riservate. RLS già coperta dalle policy esistenti `auth.uid() = user_id`.

## Ordine di implementazione

1. Migrazione DB (colonne nuove + seed `label_rules` cucina).
2. Auto-seed dept "Cucina" + revisione `NAV_VISIBILITY` e label dinamiche sidebar.
3. Rinomina "Produzione" → "Lavorazioni/Ricette", "Ricorrenti" → "Lavorazioni/Ricette ricorrenti".
4. Ingresso merci: campo temperatura + flusso contestazione.
5. Form Lavorazione: flag abbattimento + ingredienti manuali.
6. Archivio: card Cucina.
7. Report PDF: sezione Cucina.

## Domande aperte (rispondi prima che parta)

1. **Soglia temperatura di conformità** all'ingresso: vuoi un default fisso (es. refrigerato ≤+4°C, surgelato ≤−18°C) o un campo libero a tua scelta volta per volta?
2. **Contestazione fornitore**: vuoi che si apra come dialog dentro Ingresso merci (consigliato), o ti porta direttamente alla pagina Non Conformità?
3. **Voci doppione sidebar in profilo ristorazione**: ti propongo di **rimuovere** dalla sidebar `Preparati`, `Mantenimento`, `Abbattimenti`, `Frittura` come voci separate, accorpandole sotto "Lavorazioni" e "Archivio". Confermi? (Le pagine restano raggiungibili.)
4. **Etichette ricette Cucina**: confermo il modello macelleria-preparato (allergeni in grassetto + E…), oppure vuoi un layout dedicato?
