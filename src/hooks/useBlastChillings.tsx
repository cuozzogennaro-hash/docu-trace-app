import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BlastChilling = {
  id: string;
  user_id: string;
  operator_id: string | null;
  asset_id: string | null;
  product_name: string;
  cycle_type: "positive" | "negative";
  temp_start: number | null;
  temp_end: number | null;
  started_at: string;
  ended_at: string | null;
  outcome: "ok" | "anomaly";
  notes: string | null;
  created_at: string;
};

export function useBlastChillings() {
  const [rows, setRows] = useState<BlastChilling[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("blast_chillings" as any)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100);
    setRows(((data as any[]) ?? []) as BlastChilling[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("blast_chillings" as any).delete().eq("id", id);
    if (error) throw error;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { rows, loading, reload: load, remove };
}