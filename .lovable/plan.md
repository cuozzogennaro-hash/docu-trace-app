# Salumeria: shelf-life differenziata Fresco vs Sottovuoto

## Obiettivo
Permettere di gestire due tempi di scadenza per i prodotti di Salumeria:
- **Sottovuoto** (default oggi: 30 giorni)
- **Fresco** (default: 5 giorni)

Il tipo si imposta sulla scheda prodotto in fase di produzione e può essere modificato al volo al momento della stampa per la singola etichetta.

## Modifiche per area

### 1. Database
Aggiunta colonna `preservation_type` (text, valori: `fresh` | `vacuum`, default `vacuum`) sulla tabella `products`.
Aggiornata la RPC `operator_admin_insert_product` per accettare il nuovo parametro.

### 2. Logiche etichette → Salumeria
La regola **Scadenza automatica** passa da un solo parametro (`days`) a due:
- `days_fresh` (default 5)
- `days_vacuum` (default 30)

Migrazione automatica: per le regole già esistenti, il vecchio valore `days` viene copiato in `days_vacuum`. L'editor della scheda mostra due campi numerici affiancati.

### 3. Schermata Produzione
Quando il reparto del prodotto è Salumeria, compare un selettore "Conservazione":
- Sottovuoto (default)
- Fresco

Valore salvato in `products.preservation_type`.

### 4. Schermata Stampa etichetta
Nel dialog "Stampa etichetta", per i prodotti Salumeria, compare un selettore "Conservazione per questa stampa" che mostra come default il valore del prodotto, ma può essere cambiato (override solo per quella stampa). La scadenza viene ricalcolata in tempo reale e mostrata nell'anteprima.

### 5. Calcolo scadenza
Nel rendering etichetta (`computeLabelLayout` + valueMap):
```
type = override || product.preservation_type || 'vacuum'
giorni = (type === 'fresh') ? rule.days_fresh : rule.days_vacuum
scadenza = production_date + giorni
```

## File modificati / nuovi
- Migrazione Supabase: nuova colonna + aggiornamento RPC + migrazione dati `salumeria.shelf_life`
- `src/pages/Production.tsx` — selettore Conservazione per Salumeria
- `src/components/settings/LabelRulesTab.tsx` — editor `days_fresh` + `days_vacuum`
- `src/pages/ProductDetail.tsx` — selettore override nel dialog stampa + calcolo scadenza in base al tipo
