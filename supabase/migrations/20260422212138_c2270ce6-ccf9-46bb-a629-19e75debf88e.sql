-- Tasks for an operator (callable anon)
CREATE OR REPLACE FUNCTION public.operator_tasks(p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.operator_tasks(uuid) TO anon, authenticated;

-- Record sanitation
CREATE OR REPLACE FUNCTION public.operator_record_sanitation(
  p_operator_id uuid,
  p_pin text,
  p_asset_id uuid,
  p_event_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op record;
  v_expected text;
  v_product text;
  v_id uuid;
BEGIN
  SELECT id, name, user_id, pin_hash, is_active
  INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;

  IF NOT FOUND OR NOT v_op.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'operator');
  END IF;

  v_expected := encode(digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin');
  END IF;

  -- ensure asset belongs to same admin
  SELECT cleaning_product INTO v_product FROM public.assets
  WHERE id = p_asset_id AND user_id = v_op.user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'asset');
  END IF;

  INSERT INTO public.sanitations (user_id, asset_id, event_date, operator, operator_id, product_used)
  VALUES (v_op.user_id, p_asset_id, p_event_date, v_op.name, v_op.id, v_product)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.operator_record_sanitation(uuid, text, uuid, date) TO anon, authenticated;

-- Record temperature
CREATE OR REPLACE FUNCTION public.operator_record_temperature(
  p_operator_id uuid,
  p_pin text,
  p_asset_id uuid,
  p_temperature numeric,
  p_event_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op record;
  v_expected text;
  v_id uuid;
BEGIN
  SELECT id, name, user_id, pin_hash, is_active
  INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;

  IF NOT FOUND OR NOT v_op.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'operator');
  END IF;

  v_expected := encode(digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin');
  END IF;

  PERFORM 1 FROM public.assets WHERE id = p_asset_id AND user_id = v_op.user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'asset');
  END IF;

  INSERT INTO public.temperatures (user_id, asset_id, event_date, temperature, operator, operator_id)
  VALUES (v_op.user_id, p_asset_id, p_event_date, p_temperature, v_op.name, v_op.id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.operator_record_temperature(uuid, text, uuid, numeric, date) TO anon, authenticated;

-- Period completion check
CREATE OR REPLACE FUNCTION public.operator_period_status(p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
                  WHEN 'daily' THEN CURRENT_DATE
                  WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::date
                  WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::date
                END
              )
          )
          ELSE EXISTS (
            SELECT 1 FROM public.temperatures t
            WHERE t.operator_id = p_operator_id
              AND t.asset_id = ta.asset_id
              AND t.event_date >= (
                CASE ta.frequency
                  WHEN 'daily' THEN CURRENT_DATE
                  WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE)::date
                  WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::date
                END
              )
          )
        END
      ))
      FROM public.task_assignments ta
      WHERE ta.operator_id = p_operator_id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.operator_period_status(uuid) TO anon, authenticated;