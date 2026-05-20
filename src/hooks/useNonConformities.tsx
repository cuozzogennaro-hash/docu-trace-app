import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NonConformity = {
  id: string;
  user_id: string;
  operator_id: string | null;
  area: "temperatura" | "pulizia" | "fornitore" | "attrezzatura" | "prodotto" | "altro";
  severity: "low" | "medium" | "high";
  title: string;
  description: string | null;
  corrective_action: string | null;
  status: "open" | "resolved";
  detected_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useNonConformities() {
  const [rows, setRows] = useState<NonConformity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("non_conformities" as any)
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(200);
    setRows(((data as any[]) ?? []) as NonConformity[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
}