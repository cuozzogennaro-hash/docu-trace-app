import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HoldingRecord = {
  id: string;
  user_id: string;
  operator_id: string | null;
  asset_id: string | null;
  product_name: string;
  mode: "hot" | "cold" | "regeneration";
  temperature: number | null;
  recorded_at: string;
  outcome: "ok" | "anomaly" | "pending";
  notes: string | null;
  created_at: string;
};

export function useHoldingRecords() {
  const [rows, setRows] = useState<HoldingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("holding_records" as any)
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(100);
    setRows(((data as any[]) ?? []) as HoldingRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
}