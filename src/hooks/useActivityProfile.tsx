import { useCallback, useEffect, useState } from "react";

export type ActivityProfile = "laboratorio" | "ristorazione" | "misto";

const KEY = "haccp.activityProfile";

export const ACTIVITY_LABELS: Record<ActivityProfile, { label: string; description: string; emoji: string }> = {
  laboratorio: {
    label: "Laboratorio / Negozio",
    description: "Macelleria, salumeria, gastronomia, ortofrutta, supermercato",
    emoji: "🥩",
  },
  ristorazione: {
    label: "Ristorazione",
    description: "Ristorante, pizzeria, bar, mensa, catering",
    emoji: "🍽️",
  },
  misto: {
    label: "Attività mista",
    description: "Combinazione (es. macelleria con cucina, gastronomia con somministrazione)",
    emoji: "🏪",
  },
};

function read(): ActivityProfile | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "laboratorio" || v === "ristorazione" || v === "misto") return v;
    return null;
  } catch {
    return null;
  }
}

export function useActivityProfile() {
  const [profile, setProfileState] = useState<ActivityProfile | null>(() => read());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setProfileState(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setProfile = useCallback((p: ActivityProfile) => {
    localStorage.setItem(KEY, p);
    setProfileState(p);
    // notify same-tab listeners
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: p }));
  }, []);

  return { profile, setProfile };
}

/**
 * Voci sidebar visibili per ogni profilo.
 * Le rotte rimangono SEMPRE accessibili: questo filtro influisce solo
 * sulla sidebar per ridurre il rumore visivo.
 */
export const NAV_VISIBILITY: Record<ActivityProfile, Set<string>> = {
  laboratorio: new Set([
    "/", "/sanificazione", "/temperature",
    "/ingresso", "/produzione", "/archivio", "/ricorrenti",
    "/clienti", "/acquisti",
    "/non-conformita", "/report", "/impostazioni",
  ]),
  ristorazione: new Set([
    "/", "/sanificazione", "/temperature",
    "/ingresso", "/archivio",
    "/produzione", "/ricorrenti", "/menu",
    "/acquisti",
    "/non-conformita", "/report", "/impostazioni",
  ]),
  misto: new Set([
    "/", "/sanificazione", "/temperature",
    "/ingresso", "/produzione", "/archivio", "/ricorrenti",
    "/menu",
    "/clienti", "/acquisti",
    "/non-conformita", "/report", "/impostazioni",
  ]),
};

/**
 * Etichetta dinamica della voce "Produzione" in base al profilo.
 * - ristorazione → "Ricette"
 * - altri → "Lavorazioni"
 */
export function productionLabel(profile: ActivityProfile | null): string {
  return profile === "ristorazione" ? "Ricette" : "Lavorazioni";
}

export function recurringLabel(profile: ActivityProfile | null): string {
  return profile === "ristorazione" ? "Ricette ricorrenti" : "Lavorazioni ricorrenti";
}

/** I profili in cui il reparto Cucina è un reparto a tutti gli effetti. */
export function hasKitchen(profile: ActivityProfile | null): boolean {
  return profile === "ristorazione" || profile === "misto";
}