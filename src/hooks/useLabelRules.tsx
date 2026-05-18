import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type LabelRule = {
  id: string;
  department_key: string;
  rule_key: string;
  title: string;
  description: string;
  params: Record<string, any>;
  sort_order: number;
};

export function useLabelRules() {
  const { session } = useAuth();
  const [rules, setRules] = useState<LabelRule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) { setRules([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("label_rules" as any)
      .select("id, department_key, rule_key, title, description, params, sort_order")
      .order("department_key")
      .order("sort_order");
    setRules(((data as any[]) ?? []) as LabelRule[]);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  function get(department_key: string, rule_key: string): LabelRule | undefined {
    return rules.find((r) => r.department_key === department_key && r.rule_key === rule_key);
  }

  function param<T = any>(department_key: string, rule_key: string, key: string, fallback: T): T {
    const r = get(department_key, rule_key);
    const v = r?.params?.[key];
    return (v === undefined || v === null) ? fallback : (v as T);
  }

  return { rules, loading, reload: load, get, param };
}
