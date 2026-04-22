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

export function useCompany() {
  const [company, setCompany] = useState<Company>(empty);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("company_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setCompany(data ?? empty);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { company, loading, reload: load };
}