import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Department = {
  id: string;
  name: string;
  sort_order: number;
};

const HIDDEN_KEY = "hiddenDepartmentIds";
const OP_KEY = "haccp.operator";

function readHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => readHidden());

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    let rows: Department[] = [];
    if (session) {
      const { data } = await supabase
        .from("departments")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      rows = (data as Department[]) ?? [];
    } else {
      // Operator-admin fallback: no Supabase session, use security-definer RPC
      try {
        const raw = localStorage.getItem(OP_KEY);
        const op = raw ? JSON.parse(raw) : null;
        if (op?.is_admin && op?.pin && op?.id) {
          const { data } = await supabase.rpc("operator_admin_list" as any, {
            p_operator_id: op.id,
            p_pin: op.pin,
            p_table: "departments",
          });
          const payload = data as { ok: boolean; rows?: any[] } | null;
          rows = ((payload?.rows ?? []) as Department[])
            .slice()
            .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
        }
      } catch {}
    }
    setDepartments(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HIDDEN_KEY) setHiddenIds(readHidden());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setHidden = useCallback((id: string, hidden: boolean) => {
    setHiddenIds((prev) => {
      const set = new Set(prev);
      if (hidden) set.add(id); else set.delete(id);
      const next = Array.from(set);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const visibleDepartments = departments.filter((d) => !hiddenIds.includes(d.id));

  return { departments, visibleDepartments, hiddenIds, setHidden, loading, reload: load };
}