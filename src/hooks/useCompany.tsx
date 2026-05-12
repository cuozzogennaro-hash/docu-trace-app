import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Company = {
  id?: string;
  business_name: string | null;
  vat: string | null;
  address: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
};

const empty: Company = {
  business_name: null,
  vat: null,
  address: null,
  logo_url: null,
  email: null,
  phone: null,
};

const OP_KEY = "haccp.operator";

export function useCompany() {
  const [company, setCompany] = useState<Company>(empty);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setCompany(data ?? empty);
    } else {
      // Operator-admin fallback: load admin's company via RPC
      try {
        const raw = localStorage.getItem(OP_KEY);
        const op = raw ? JSON.parse(raw) : null;
        if (op?.id) {
          const { data } = await supabase.rpc("operator_company" as any, {
            p_operator_id: op.id,
          });
          const payload = data as { ok: boolean; company?: Partial<Company> | null } | null;
          if (payload?.ok && payload.company) {
            setCompany({ ...empty, ...payload.company });
          } else {
            setCompany(empty);
          }
        } else {
          setCompany(empty);
        }
      } catch {
        setCompany(empty);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { company, loading, reload: load };
}