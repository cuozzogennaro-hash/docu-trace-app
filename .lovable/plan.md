## Obiettivo

Trasformare l'attuale `Reports.tsx` (che già esporta i singoli registri) in un **Pacchetto Ispezione ASL**: un unico PDF "ufficiale", strutturato come un Manuale di Autocontrollo, con copertina, anagrafiche, sintesi, tutti i registri, non conformità e pagina firma. È il documento che il titolare stampa o invia al controllo ASL senza ulteriori manipolazioni.

## Cosa cambia (per l'utente)

In `/report` aggiungiamo un nuovo blocco in alto, sopra ai pulsanti attuali:

```
┌─────────────────────────────────────────────────────────┐
│  📋  Pacchetto Ispezione ASL                            │
│  Tutto quello che serve per il controllo,               │
│  in un unico PDF firmabile.                             │
│                                                          │
│  Periodo:   [▾ Ultimo mese | Trimestre | Anno | Custom] │
│  Includi:   [✓] Anagrafiche  [✓] Sintesi & anomalie    │
│             [✓] Non conformità  [✓] Foto allegate       │
│  Firma:     [Carica immagine firma]  (opzionale)        │
│                                                          │
│  [⬇ Genera Pacchetto Ispezione ASL]                     │
└─────────────────────────────────────────────────────────┘
```

I pulsanti per i singoli registri restano invariati sotto, per chi vuole solo una sezione.

## Struttura del PDF generato

1. **Copertina** — logo, ragione sociale, P.IVA, indirizzo, periodo, data emissione, "Documento di autocontrollo HACCP — Reg. CE 852/2004"
2. **Indice cliccabile** (bookmarks PDF)
3. **Anagrafica azienda** — dati completi + responsabile autocontrollo
4. **Operatori abilitati** — tabella nome / ruolo / data attivazione (no PIN, ovviamente)
5. **Attrezzature e punti di controllo** — tabella asset con range temperatura, reparto, prodotto sanificante
6. **Fornitori** — elenco con P.IVA
7. **Sintesi del periodo** — pagina riassuntiva con:
   - # rilevazioni temperatura, % conformità, # anomalie evidenziate
   - # sanificazioni eseguite vs programmate
   - # produzioni / lotti emessi
   - # abbattimenti, # holding records, # controlli olio
   - # non conformità aperte / chiuse
   - grafico semplice (mini-barre disegnate via jsPDF) conformità per settimana
8. **Registri completi** (riusando le funzioni `tempTable`, `sanitTable`, ecc. già esistenti)
9. **Non conformità & azioni correttive** — registro dedicato con data, descrizione, azione, esito, data chiusura
10. **Dichiarazione e firma** finale — testo legale standard + riquadro firma con immagine caricata, oppure righe per firma manuale, data e luogo

## Decisioni tecniche

- Tutto client-side con `jsPDF` + `jspdf-autotable` (già in uso), nessuna nuova dipendenza obbligatoria
- Periodo flessibile: helper `periodRange(kind, customStart, customEnd)` che sostituisce l'attuale `monthRange`
- Sintesi calcolata in memoria sui dati già fetchati, senza nuove query
- Bookmarks PDF via `doc.outline.add(...)` di jsPDF
- Foto allegate (es. `raw_materials.document_image_url`): scaricate e inserite in appendice solo se l'utente attiva il toggle, con limite a N immagini per evitare PDF da 50 MB
- Firma: input `<Input type="file" accept="image/*">`, convertita a dataURL in memoria, mai salvata sul server
- Nessuna modifica al database

## File toccati

- `src/pages/Reports.tsx` — refactor: estrarre `periodRange`, `drawCover`, `drawIndex`, `drawAnagrafica`, `drawOperatori`, `drawAssets`, `drawSuppliers`, `drawSummary`, `drawSignaturePage`, aggiungere `generateAslPackage()` e relativo blocco UI
- `src/hooks/useCompany.tsx` — verifica che esponga già tutti i campi (city, phone, email); se manca qualcosa, query supplementare locale a `Reports.tsx`
- Nessuna nuova migration

## Fuori scopo (per ora)

- Firma digitale qualificata (CAdES/PAdES) — richiede integrazione con Aruba/InfoCert, lo proponiamo come step 2
- Invio diretto via email/PEC al consulente HACCP — step 2
- Generazione del **Manuale HACCP** vero e proprio (analisi rischi, CCP, ecc.) — è un prodotto a sé
- Multi-sede nel PDF (resta single-tenant come oggi)

## Domande aperte (rispondi quando passiamo in build, oppure procedo con default)

1. Periodi proposti: **Ultimo mese / Trimestre / Anno / Personalizzato** — ok così? Default: ultimo mese.
2. Foto allegate: includerle **solo per le materie prime con anomalia** o **tutte quelle disponibili**? Default proposto: tutte, ma con tetto a 30 foto.
3. Firma: vuoi anche la possibilità di caricare la firma del **consulente HACCP esterno** oltre a quella del titolare? Default: solo titolare.
