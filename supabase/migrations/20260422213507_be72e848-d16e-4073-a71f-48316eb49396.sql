-- Fix: qualify digest() with extensions schema since pgcrypto lives in extensions
-- and these SECURITY DEFINER functions set search_path = public.

CREATE OR REPLACE FUNCTION public.operator_login(p_handle text, p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_op record;
  v_expected text;
BEGIN
  SELECT id, name, role, user_id, pin_hash, is_active
  INTO v_op
  FROM public.operators
  WHERE login_handle = lower(trim(p_handle))
  LIMIT 1;

  IF NOT FOUND OR NOT v_op.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');

  IF v_expected <> v_op.pin_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'operator_id', v_op.id,
    'name', v_op.name,
    'role', v_op.role,
    'admin_user_id', v_op.user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.operator_record_sanitation(p_operator_id uuid, p_pin text, p_asset_id uuid, p_event_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin');
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.operator_record_temperature(p_operator_id uuid, p_pin text, p_asset_id uuid, p_temperature numeric, p_event_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
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
$function$;