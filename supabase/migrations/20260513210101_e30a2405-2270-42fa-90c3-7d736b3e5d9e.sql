CREATE OR REPLACE FUNCTION public.admin_overdue_tasks(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now time := (now() AT TIME ZONE 'Europe/Rome')::time;
  v_today date := (now() AT TIME ZONE 'Europe/Rome')::date;
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'assignment_id', ta.id,
    'operator_id', ta.operator_id,
    'operator_name', op.name,
    'asset_id', ta.asset_id,
    'asset_name', a.name,
    'task_type', ta.task_type,
    'frequency', ta.frequency,
    'due_time', ta.due_time
  )), '[]'::jsonb)
  INTO v_result
  FROM public.task_assignments ta
  JOIN public.operators op ON op.id = ta.operator_id
  JOIN public.assets a ON a.id = ta.asset_id
  WHERE ta.user_id = p_user_id
    AND ta.due_time IS NOT NULL
    AND (v_now - ta.due_time) >= interval '30 minutes'
    AND NOT (
      CASE ta.task_type
        WHEN 'sanitation' THEN EXISTS (
          SELECT 1 FROM public.sanitations s
          WHERE s.operator_id = ta.operator_id
            AND s.asset_id = ta.asset_id
            AND s.event_date >= (
              CASE ta.frequency
                WHEN 'daily' THEN v_today
                WHEN 'weekly' THEN date_trunc('week', v_today)::date
                WHEN 'monthly' THEN date_trunc('month', v_today)::date
                ELSE v_today
              END
            )
        )
        ELSE EXISTS (
          SELECT 1 FROM public.temperatures t
          WHERE t.operator_id = ta.operator_id
            AND t.asset_id = ta.asset_id
            AND t.event_date >= (
              CASE ta.frequency
                WHEN 'daily' THEN v_today
                WHEN 'weekly' THEN date_trunc('week', v_today)::date
                WHEN 'monthly' THEN date_trunc('month', v_today)::date
                ELSE v_today
              END
            )
        )
      END
    );
  RETURN jsonb_build_object('ok', true, 'tasks', v_result);
END;
$$;