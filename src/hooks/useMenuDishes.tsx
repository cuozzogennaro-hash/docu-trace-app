import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MenuDish = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  description: string | null;
  allergen_ids: string[];
  price: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function useMenuDishes() {
  const [rows, setRows] = useState<MenuDish[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("menu_dishes" as any)
      .select("*")
      .order("sort_order")
      .order("name");
    setRows(((data as any[]) ?? []) as MenuDish[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
}