CREATE OR REPLACE FUNCTION public.operator_period_status(p_operator_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid;
BEGIN
  SELECT user_id INTO v_admin FROM public.operators WHERE id = p_operator_id AND is_active = true;
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'done', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'asset_id', ta.asset_id,
        'task_type', ta.task_type,
        'done', CASE
          WHEN ta.task_type = 'sanitation' THEN EXISTS (
            SELECT 1 FROM public.sanitations s
            WHERE s.operator_id = p_operator_id
              AND s.asset_id = ta.asset_id
              AND s.event_date >= (
                CASE ta.frequency
                  WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::date
                  WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::date
                  ELSE CURRENT_DATE
                END
              )
          )
          ELSE EXISTS (
            SELECT 1 FROM public.temperatures t
            WHERE t.operator_id = p_operator_id
              AND t.asset_id = ta.asset_id
              AND t.event_date >= (
                CASE ta.frequency
                  WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::date
                  WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::date
                  ELSE CURRENT_DATE
                END
              )
          )
        END
      ))
      FROM public.task_assignments ta
      WHERE ta.operator_id = p_operator_id
        AND NOT EXISTS (
          SELECT 1 FROM public.non_conformities nc
          WHERE nc.user_id = v_admin
            AND nc.asset_id = ta.asset_id
            AND nc.status = 'open'
        )
    ), '[]'::jsonb)
  );
END;
$function$;