import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useSuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      setIsSuperAdmin(!!data);
      setLoading(false);
    })();
  }, [user, authLoading]);

  return { isSuperAdmin, loading };
}

export function useTrackLastSeen() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    supabase.rpc("touch_last_seen" as any).then(() => {});
  }, [user]);
}