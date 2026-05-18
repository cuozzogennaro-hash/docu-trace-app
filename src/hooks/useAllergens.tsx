import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Allergen = {
  id: string;
  name: string;
  keywords: string[];
  notes: string | null;
  sort_order: number;
};

export function useAllergens() {
  const { session } = useAuth();
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) { setAllergens([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("allergens" as any)
      .select("id, name, keywords, notes, sort_order")
      .order("sort_order")
      .order("name");
    setAllergens(((data as any[]) ?? []) as Allergen[]);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  return { allergens, loading, reload: load };
}