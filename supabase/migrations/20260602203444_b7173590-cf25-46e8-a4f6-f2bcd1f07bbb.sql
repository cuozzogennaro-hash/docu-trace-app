CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

CREATE OR REPLACE FUNCTION public.super_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'users', COALESCE(jsonb_agg(row_to_jsonb(u) ORDER BY u.created_at DESC), '[]'::jsonb)
  ) INTO v_result
  FROM (
    SELECT
      p.id,
      p.email,
      p.business_name,
      p.created_at,
      p.last_seen_at,
      p.onboarding_completed,
      (
        SELECT jsonb_build_object(
          'status', s.status,
          'environment', s.environment,
          'current_period_end', s.current_period_end,
          'cancel_at_period_end', s.cancel_at_period_end,
          'paddle_subscription_id', s.paddle_subscription_id
        )
        FROM public.subscriptions s
        WHERE s.user_id = p.id
        ORDER BY s.updated_at DESC NULLS LAST
        LIMIT 1
      ) AS subscription
    FROM public.profiles p
  ) u;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.super_admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_overview() TO authenticated;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role FROM auth.users WHERE lower(email) = 'gennarocuozzo@tiscali.it'
ON CONFLICT DO NOTHING;