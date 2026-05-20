import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OilCheck = {
  id: string;
  user_id: string;
  operator_id: string | null;
  asset_id: string | null;
  fryer_name: string | null;
  polar_compounds: number | null;
  action: "check" | "filter" | "change";
  outcome: "ok" | "anomaly";
  notes: string | null;
  checked_at: string;
  created_at: string;
};

export function useOilChecks() {
  const [rows, setRows] = useState<OilCheck[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("oil_checks" as any)
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(100);
    setRows(((data as any[]) ?? []) as OilCheck[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
}