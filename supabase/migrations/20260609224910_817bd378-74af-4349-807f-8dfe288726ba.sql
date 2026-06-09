
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS out_of_service boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS out_of_service_reason text,
  ADD COLUMN IF NOT EXISTS out_of_service_since timestamptz;

-- Escludi gli asset fuori servizio dai task degli operatori
CREATE OR REPLACE FUNCTION public.operator_tasks(p_operator_id uuid)
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
    'tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ta.id,
        'asset_id', ta.asset_id,
        'task_type', ta.task_type,
        'frequency', ta.frequency,
        'asset', jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'asset_type', a.asset_type,
          'cleaning_product', a.cleaning_product,
          'target_temp_min', a.target_temp_min,
          'target_temp_max', a.target_temp_max
        )
      ))
      FROM public.task_assignments ta
      JOIN public.assets a ON a.id = ta.asset_id
      WHERE ta.operator_id = p_operator_id
        AND COALESCE(a.out_of_service, false) = false
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

CREATE OR REPLACE FUNCTION public.admin_overdue_tasks(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND COALESCE(a.out_of_service, false) = false
    AND (v_now - ta.due_time) >= interval '30 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.non_conformities nc
      WHERE nc.user_id = p_user_id
        AND nc.asset_id = ta.asset_id
        AND nc.status = 'open'
    )
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
$function$;

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
      JOIN public.assets a ON a.id = ta.asset_id
      WHERE ta.operator_id = p_operator_id
        AND COALESCE(a.out_of_service, false) = false
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
