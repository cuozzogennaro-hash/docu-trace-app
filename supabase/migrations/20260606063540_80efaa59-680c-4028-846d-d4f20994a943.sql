
CREATE OR REPLACE FUNCTION public.super_admin_overview()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'users', COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.created_at DESC), '[]'::jsonb)
  ) INTO v_result
  FROM (
    SELECT
      p.id, p.email, p.business_name, p.created_at, p.last_seen_at, p.onboarding_completed,
      (
        SELECT jsonb_build_object(
          'status', s.status, 'environment', s.environment,
          'current_period_end', s.current_period_end,
          'cancel_at_period_end', s.cancel_at_period_end,
          'paddle_subscription_id', s.paddle_subscription_id
        )
        FROM public.subscriptions s WHERE s.user_id = p.id
        ORDER BY s.updated_at DESC NULLS LAST LIMIT 1
      ) AS subscription
    FROM public.profiles p
  ) u;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.super_admin_traffic_overview(p_days integer DEFAULT 7)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz;
  v_daily jsonb; v_top_pages jsonb; v_devices jsonb; v_totals jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_since := now() - (GREATEST(p_days, 1) || ' days')::interval;

  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.day), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/Rome'), 'YYYY-MM-DD') AS day,
           COUNT(*) AS pageviews, COUNT(DISTINCT session_id) AS visitors
    FROM public.page_views WHERE created_at >= v_since GROUP BY 1
  ) d;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.views DESC), '[]'::jsonb) INTO v_top_pages
  FROM (
    SELECT path AS label, COUNT(*) AS views FROM public.page_views
    WHERE created_at >= v_since GROUP BY path ORDER BY COUNT(*) DESC LIMIT 15
  ) p;

  SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_devices
  FROM (
    SELECT COALESCE(device, 'unknown') AS label, COUNT(*) AS views
    FROM public.page_views WHERE created_at >= v_since GROUP BY 1 ORDER BY COUNT(*) DESC
  ) d;

  SELECT jsonb_build_object(
    'pageviews', COUNT(*),
    'visitors', COUNT(DISTINCT session_id),
    'native_share', ROUND(100.0 * SUM(CASE WHEN is_native THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1), 1)
  ) INTO v_totals FROM public.page_views WHERE created_at >= v_since;

  RETURN jsonb_build_object(
    'ok', true, 'since', v_since, 'totals', v_totals,
    'daily', v_daily, 'top_pages', v_top_pages, 'devices', v_devices
  );
END;
$function$;
