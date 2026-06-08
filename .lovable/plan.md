# Modulo "Punti Vendita" (Stores) e Integrazione Bilance di Reparto

Implementazione in 3 fasi (DB → backend logic → UI condizionale), con priorità assoluta alla **retrocompatibilità**: nessun utente esistente deve vedere differenze o perdere dati.

---

## Fase 1 — Database (1 migrazione unica)

### Nuova tabella `public.stores`
- `id` uuid PK (default `gen_random_uuid()`)
- `user_id` uuid NOT NULL → `auth.users(id)` ON DELETE CASCADE  *(necessario per isolare i punti vendita per account-admin e per RLS)*
- `name` text NOT NULL
- `address` text
- `scale_integration_active` boolean NOT NULL DEFAULT `false`
- `scale_api_key` uuid NOT NULL DEFAULT `gen_random_uuid()` UNIQUE
- `created_at`, `updated_at` timestamptz + trigger `touch_updated_at`
- GRANT a `authenticated` + `service_role`
- RLS: ogni utente vede/gestisce solo i propri store (`auth.uid() = user_id`)

### Aggiunta `store_id` a `profiles`
- Colonna `store_id` uuid → `stores(id)` ON DELETE SET NULL (nullable per non bloccare INSERT)
- **Migrazione dati esistenti**: per ogni `profiles.id` senza `store_id`, crea uno store *"Punto Vendita Principale"* con `scale_integration_active=false` e popola `profiles.store_id` (in un'unica CTE, idempotente).
- **Nuovi utenti**: aggiorno `handle_new_user()` per creare automaticamente lo store di default e collegarlo al profilo appena creato.

### Nuova tabella `public.scales_queue`
- `id` bigint generated always as identity PK
- `user_id` uuid NOT NULL → `auth.users(id)` *(per RLS lato app)*
- `store_id` uuid NOT NULL → `stores(id)` ON DELETE CASCADE
- `plu_code` text NOT NULL
- `product_name` text
- `lot_number` text
- `ingredients` text
- `status` text NOT NULL DEFAULT `'pending'` + CHECK in (`'pending'`,`'processed'`)
- `created_at`, `updated_at` + trigger
- Indici: `(store_id, status)`, `(scale_api_key)` lato stores
- GRANT + RLS: utente accede solo alle righe dei propri store (via subquery su `stores.user_id = auth.uid()`)
- `service_role` ha pieno accesso (lo userà l'endpoint che l'applicativo PC del negozio chiamerà via `scale_api_key`)

---

## Fase 2 — Hook & helper applicazione

- Nuovo hook `useStores.tsx` per CRUD store del proprio account.
- Nuovo hook `useCurrentStore.tsx` che legge `profiles.store_id` dell'utente loggato e restituisce `{ store, scaleIntegrationActive }` con cache react-query. Esposto globalmente.
- Tutti i punti del codice che inseriscono dati di tracciabilità (produzione, materia prima, preparati) ricevono `store_id` dal current store; finché c'è un solo store per account, è trasparente.

## Fase 3 — UI

### A) Impostazioni → nuovo tab "Punti Vendita"
- Elenco store dell'account
- Form add/edit: nome, indirizzo, toggle `scale_integration_active`
- Quando attivo, mostra la `scale_api_key` (copy-to-clipboard) con avviso "Inserisci questa chiave nell'applicativo del PC della bilancia".
- Il tab è sempre visibile ma per i micro-utenti è solo un'opzione: lo store di default è già lì pre-popolato.

### B) Sezione "Bilance di reparto" nei form di produzione/tracciabilità
- Renderizzata **solo se** `currentStore.scale_integration_active === true`.
- Campi: `plu_code`, `product_name` (precompilato), `lot_number` (precompilato dal lotto interno), `ingredients` (precompilato).
- Al salvataggio del record principale, in transazione lato client viene inserita anche una riga in `scales_queue` con `status='pending'`.
- Per tutti gli utenti esistenti il flag resta `false` → la sezione **non compare**, nessun cambio percepito.

### C) Admin "Coda bilance" (opzionale, fase successiva)
Pagina di sola lettura con stato code per debug; la metto dietro flag, non in questa iterazione se preferisci.

---

## Dettagli tecnici riassunti

- 1 migrazione SQL atomica che fa: CREATE tabelle + GRANT + RLS + POLICY + back-fill dati esistenti + update `handle_new_user`.
- Nessun edge function in questa iterazione (l'endpoint per l'applicativo PC della bilancia lo aggiungiamo in fase 2 quando definiamo il contratto API).
- Zero breaking change: tutte le query attuali ignorano `store_id` perché nullable e nessun codice esistente lo legge.

---

## Domanda prima di procedere

Il tuo messaggio finale era troncato sulla logica UI ("…come per tutti i vecchi utenti"). Confermo che la regola è: **se `scale_integration_active = false` la sezione bilance NON viene proprio renderizzata** (non disabilitata, non visibile). Procedo così?

Inoltre: vuoi che includa anche l'endpoint HTTP (edge function) `GET /scales-queue?api_key=...` per far scaricare al PC del negozio le righe `pending` e marcarle `processed`, o lo lasciamo a un secondo step?