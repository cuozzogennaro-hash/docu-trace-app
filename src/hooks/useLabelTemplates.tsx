import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type LabelTemplate = {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  layout_config: { rotate_print?: boolean };
  is_default: boolean;
};

export function useLabelTemplates() {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) { setTemplates([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("label_templates")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at");
      const list = (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        width_mm: Number(d.width_mm),
        height_mm: Number(d.height_mm),
        layout_config: typeof d.layout_config === "string" ? JSON.parse(d.layout_config) : (d.layout_config || {}),
        is_default: !!d.is_default,
      })) as LabelTemplate[];
      setTemplates(list);
      setLoading(false);
    })();
  }, [session?.user?.id]);

  const defaultTemplate = templates.find((t) => t.is_default) ?? templates[0] ?? null;

  return { templates, defaultTemplate, loading };
}