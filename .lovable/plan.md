## Obiettivo

Oggi `check-overdue-tasks` viene invocato dal cron molto frequentemente (dai log, ogni ~20-60s) e re-invia la push per **ogni** task scaduto a **ogni** tick, finché l'operatore non completa l'azione. Risultato: notifiche martellanti. Vogliamo **massimo 1 push ogni 10 minuti per coppia (task_assignment)**.

## Soluzione

### 1. Migration

Aggiungere una colonna su `task_assignments`:

```sql
ALTER TABLE public.task_assignments
  ADD COLUMN last_notified_at timestamptz;
```

Nessuna RLS da toccare (la tabella ha già la policy `own task_assignments`), nessun GRANT aggiuntivo. La edge function scrive con `service_role`, bypassa RLS.

### 2. Modifica `supabase/functions/check-overdue-tasks/index.ts`

- Includere `last_notified_at` nella select iniziale.
- Dopo aver costruito la lista `overdueTasks` (già filtrata per non-completati), applicare il filtro cooldown:
  ```ts
  const COOLDOWN_MS = 10 * 60 * 1000;
  const cooldownIso = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const tasksToNotify = overdueTasks.filter(t =>
    !t.last_notified_at || t.last_notified_at < cooldownIso
  );
  ```
- Iterare su `tasksToNotify` per inviare push a operatore + admin (logica attuale invariata).
- Per ogni task in cui almeno una delle due push è stata accettata dal push service, accumulare l'id; alla fine, singolo UPDATE batch:
  ```ts
  if (notifiedIds.length > 0) {
    await supabase
      .from("task_assignments")
      .update({ last_notified_at: new Date().toISOString() })
      .in("id", notifiedIds);
  }
  ```
- Rimuovere il blocco `if (taskError)` duplicato (refuso esistente nel file).

## Comportamento risultante

- **Task appena diventato scaduto** (30+ min oltre `due_time`): prima push parte al primo tick utile, `last_notified_at = now()`.
- **Cron continua a girare ogni minuto**: per i 10 minuti successivi il task viene scartato dal filtro.
- **Operatore completa l'azione**: il task esce dalla query degli scaduti (controllo già esistente su `sanitations`/`temperatures`), nessuna ulteriore push.
- **Task ancora aperto dopo 10 min**: nuova push, e così via, max 6 push/ora per task.
- **Nuovo giorno (frequency `daily`)**: il task torna scaduto, `last_notified_at` è di ieri → parte la prima push del giorno regolarmente.

## File toccati

- **Nuova migration**: aggiunta colonna `last_notified_at` a `task_assignments`.
- **`supabase/functions/check-overdue-tasks/index.ts`**: select estesa, filtro cooldown, UPDATE batch finale, rimozione blocco duplicato.

## Fuori scopo

- Banner "Installa come PWA" per sbloccare push su iOS Safari (lo trattiamo come task separato se vuoi).
- Migrazione a push native APN/FCM via Capacitor.
- Configurazione cron `pg_cron`: dai log risulta già attivo.
