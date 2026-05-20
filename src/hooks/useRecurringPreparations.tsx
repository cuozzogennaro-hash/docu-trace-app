import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RecurringPreparation = {
  id: string;
  user_id: string;
  name: string;
  storage_type: "frigo" | "freezer" | "ambiente";
  shelf_hours: number;
  allergen_ids: string[];
  raw_material_ids: string[];
  ingredients_text: string | null;
  notes: string | null;
  use_count: number;
  last_used_at: string | null;
};

export function useRecurringPreparations() {
  const [rows, setRows] = useState<RecurringPreparation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("recurring_preparations" as any)
      .select("*")
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("name");
    setRows(((data as any[]) ?? []) as RecurringPreparation[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (payload: Omit<RecurringPreparation, "id" | "user_id" | "use_count" | "last_used_at">) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sessione scaduta");
    const { error } = await supabase.from("recurring_preparations" as any).insert({
      user_id: user.id,
      ...payload,
    });
    if (error) throw error;
    await load();
  }, [load]);

  const touch = useCallback(async (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    await supabase.from("recurring_preparations" as any).update({
      use_count: row.use_count + 1,
      last_used_at: new Date().toISOString(),
    }).eq("id", id);
  }, [rows]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("recurring_preparations" as any).delete().eq("id", id);
    if (error) throw error;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { rows, loading, reload: load, save, touch, remove };
}