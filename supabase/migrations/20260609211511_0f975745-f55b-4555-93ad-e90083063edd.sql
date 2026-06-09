CREATE OR REPLACE FUNCTION public.start_local_trial(p_env text DEFAULT 'live'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_env NOT IN ('live','sandbox') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_env');
  END IF;

  SELECT id INTO v_existing
  FROM public.subscriptions
  WHERE user_id = v_uid AND environment = p_env
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'id', v_existing, 'created', false);
  END IF;

  INSERT INTO public.subscriptions (
    user_id, paddle_subscription_id, paddle_customer_id,
    product_id, price_id, status,
    current_period_start, current_period_end,
    cancel_at_period_end, environment
  ) VALUES (
    v_uid,
    'local_trial_' || v_uid::text || '_' || p_env,
    'local_trial',
    'haccp_pro', 'haccp_pro_monthly', 'trialing',
    now(), now() + interval '14 days',
    false, p_env
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'created', true);
END;
$function$;