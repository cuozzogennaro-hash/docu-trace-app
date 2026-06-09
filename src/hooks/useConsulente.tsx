import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useConsulente() {
  const { user, loading: authLoading } = useAuth();
  const [isConsulente, setIsConsulente] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsConsulente(false);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "consulente" as any,
      });
      setIsConsulente(!!data);
      setLoading(false);
    })();
  }, [user, authLoading]);

  return { isConsulente, loading };
}