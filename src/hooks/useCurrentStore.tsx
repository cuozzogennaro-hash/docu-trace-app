import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Store = {
  id: string;
  name: string;
  address: string | null;
  scale_integration_active: boolean;
  scale_api_key: string;
};

export function useCurrentStore() {
  const { session } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) {
      setStore(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", session.user.id)
      .maybeSingle();
    let storeId = (profile as any)?.store_id as string | null | undefined;
    if (!storeId) {
      // fallback: pick the first store owned by the user
      const { data: anyStore } = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      setStore((anyStore as any) ?? null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .maybeSingle();
    setStore((data as any) ?? null);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  return {
    store,
    loading,
    scaleIntegrationActive: !!store?.scale_integration_active,
    reload: load,
  };
}