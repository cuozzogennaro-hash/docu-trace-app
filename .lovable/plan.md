# Allergeni: caricamento + evidenziazione automatica in etichetta

## Obiettivo
1. Pre-caricare i 14 allergeni di legge nella sezione **Impostazioni → Additivi ed Allergeni**.
2. Far sì che, quando uno di questi allergeni (o un suo derivato) compare nel testo degli ingredienti di un'etichetta, venga **automaticamente evidenziato in grassetto** in tutti i reparti (Macelleria, Salumeria, Ortofrutta…), come richiesto dal Reg. UE 1169/2011.

## Cosa verrà caricato
14 voci nella tabella additivi/allergeni, ciascuna con il nome ufficiale e le sigle/sinonimi da riconoscere:

1. Glutine (grano, frumento, segale, orzo, avena, farro, kamut, spelta)
2. Crostacei (gamberi, scampi, granchio, aragosta)
3. Uova
4. Pesce
5. Arachidi
6. Soia
7. Latte (lattosio, burro, panna, formaggio, mozzarella, yogurt, ricotta)
8. Frutta a guscio (mandorle, nocciole, noci, pistacchi, anacardi, pecan, macadamia, noci del Brasile)
9. Sedano
10. Senape
11. Sesamo
12. Anidride solforosa e solfiti (SO2, E220–E228)
13. Lupini
14. Molluschi (vongole, cozze, calamari, polpo, seppia)

## Evidenziazione in etichetta
In `src/pages/ProductDetail.tsx`:
- Aggiungo un dizionario `ALLERGEN_KEYWORDS` con tutte le varianti (singolare/plurale, derivati comuni).
- Aggiungo `splitAllergenSegments(text)` che spezza una stringa in segmenti `{text, bold}` evidenziando in grassetto qualsiasi parola allergenica rilevata (matching case-insensitive su parole intere).
- Nella costruzione di `ingrSegs` (sia per stampa PDF/Bluetooth sia per anteprima a schermo, riga ~444 e ~1107), per ogni parte ingrediente:
  - se è già `bold` (additivo E…) → lasciata invariata
  - altrimenti → passata a `splitAllergenSegments` così che ogni eventuale parola allergenica diventi un sotto-segmento in grassetto.
- L'evidenziazione vale per tutti i reparti perché agisce sul testo finale degli ingredienti.

## File modificati
- `src/pages/ProductDetail.tsx` — dizionario allergeni + funzione di splitting + applicazione alla generazione segmenti etichetta.
- Caricamento dati via insert SQL in `raw_materials` (categoria `additivo_allergene`) per l'utente esistente.
