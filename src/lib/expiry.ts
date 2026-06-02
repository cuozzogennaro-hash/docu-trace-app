// Utility per il calcolo e la classificazione delle scadenze.

export type ExpiryStatus = "expired" | "today" | "soon" | "week" | "ok" | "none";

/** Restituisce la data in formato YYYY-MM-DD locale di oggi. */
export function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** Giorni interi tra oggi (00:00) e una data ISO YYYY-MM-DD. Negativo se scaduta. */
export function daysUntil(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const d = new Date(String(dateISO).slice(0, 10) + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

/** Classifica una data in stato di scadenza. */
export function getExpiryStatus(dateISO: string | null | undefined): ExpiryStatus {
  const n = daysUntil(dateISO);
  if (n === null) return "none";
  if (n < 0) return "expired";
  if (n <= 1) return "today";
  if (n <= 3) return "soon";
  if (n <= 7) return "week";
  return "ok";
}

/**
 * Calcola la data di scadenza di un prodotto finito in base a:
 * - production_date
 * - preservation_type ("fresh" → days_fresh, altrimenti days_vacuum)
 * - regole label_rules salumeria.shelf_life
 */
export function computeProductExpiry(
  productionDate: string | null | undefined,
  preservationType: string | null | undefined,
  shelfLifeParams: { days_fresh?: number; days_vacuum?: number } | null | undefined,
): string | null {
  if (!productionDate) return null;
  const pd = new Date(String(productionDate).slice(0, 10) + "T00:00:00");
  if (isNaN(pd.getTime())) return null;
  const type = preservationType || "vacuum";
  const fallback = type === "fresh" ? 5 : 30;
  const days = type === "fresh"
    ? Math.max(1, Number(shelfLifeParams?.days_fresh) || fallback)
    : Math.max(1, Number(shelfLifeParams?.days_vacuum) || fallback);
  pd.setDate(pd.getDate() + days);
  return pd.toISOString().slice(0, 10);
}

/** Tailwind/semantic classes per il pallino di stato. */
export function expiryDotClass(status: ExpiryStatus): string {
  switch (status) {
    case "expired": return "bg-destructive";
    case "today":   return "bg-orange-500";
    case "soon":    return "bg-yellow-500";
    case "week":    return "bg-emerald-500";
    case "ok":      return "bg-muted-foreground/30";
    default:        return "bg-transparent";
  }
}

export function expiryBadgeClass(status: ExpiryStatus): string {
  switch (status) {
    case "expired": return "bg-destructive/15 text-destructive border-destructive/30";
    case "today":   return "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300";
    case "soon":    return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-300";
    case "week":    return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";
    default:        return "bg-muted text-muted-foreground border-border";
  }
}

/** Etichetta breve per stato (in italiano, traducibile via i18n.t()). */
export function expiryLabel(status: ExpiryStatus, days: number | null): string {
  if (status === "expired" && days !== null) return `Scaduto da ${Math.abs(days)}g`;
  if (status === "today" && days === 0) return "Scade oggi";
  if (status === "today" && days === 1) return "Scade domani";
  if (days !== null && days > 0) return `${days}g`;
  return "—";
}