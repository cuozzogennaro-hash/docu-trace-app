import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Preparation = {
  id: string;
  user_id: string;
  operator_id: string | null;
  name: string;
  prepared_at: string;
  internal_expiry: string;
  storage_type: "frigo" | "freezer" | "ambiente";
  allergen_ids: string[];
  raw_material_ids: string[];
  ingredients_text: string | null;
  notes: string | null;
  created_at: string;
};

export function usePreparations() {
  const [rows, setRows] = useState<Preparation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("preparations" as any)
      .select("*")
      .order("prepared_at", { ascending: false })
      .limit(100);
    setRows(((data as any[]) ?? []) as Preparation[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("preparations" as any).delete().eq("id", id);
    if (error) throw error;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { rows, loading, reload: load, remove };
}