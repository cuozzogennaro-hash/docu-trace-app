
CREATE OR REPLACE FUNCTION public.operator_admin_expiries(p_operator_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_op record;
  v_expected text;
  v_raw jsonb;
  v_products jsonb;
  v_preps jsonb;
  v_depts jsonb;
  v_shelf jsonb;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;
  IF NOT FOUND OR NOT v_op.is_active THEN RETURN jsonb_build_object('ok',false,'error','operator'); END IF;
  IF NOT v_op.is_admin THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN RETURN jsonb_build_object('ok',false,'error','pin'); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'product_name', product_name, 'internal_lot', internal_lot,
    'expiry_date', expiry_date, 'department_id', department_id
  )), '[]'::jsonb) INTO v_raw
  FROM public.raw_materials
  WHERE user_id = v_op.user_id AND COALESCE(is_out_of_stock,false) = false AND expiry_date IS NOT NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'internal_lot', internal_lot,
    'production_date', production_date, 'preservation_type', preservation_type,
    'expiry_date', expiry_date, 'department_id', department_id
  )), '[]'::jsonb) INTO v_products
  FROM public.products
  WHERE user_id = v_op.user_id AND COALESCE(is_out_of_stock,false) = false;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'internal_expiry', internal_expiry
  )), '[]'::jsonb) INTO v_preps
  FROM public.preparations
  WHERE user_id = v_op.user_id AND COALESCE(is_out_of_stock,false) = false;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]'::jsonb) INTO v_depts
  FROM public.departments WHERE user_id = v_op.user_id;

  SELECT to_jsonb(params) INTO v_shelf
  FROM public.label_rules
  WHERE user_id = v_op.user_id AND department_key = 'salumeria' AND rule_key = 'shelf_life'
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'raw_materials', v_raw,
    'products', v_products,
    'preparations', v_preps,
    'departments', v_depts,
    'shelf_life', COALESCE(v_shelf, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.operator_admin_mark_out_of_stock(
  p_operator_id uuid, p_pin text, p_kind text, p_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_op record;
  v_expected text;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;
  IF NOT FOUND OR NOT v_op.is_active THEN RETURN jsonb_build_object('ok',false,'error','operator'); END IF;
  IF NOT v_op.is_admin THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN RETURN jsonb_build_object('ok',false,'error','pin'); END IF;

  IF p_kind = 'raw' THEN
    UPDATE public.raw_materials SET is_out_of_stock = true WHERE id = p_id AND user_id = v_op.user_id;
  ELSIF p_kind = 'product' THEN
    UPDATE public.products SET is_out_of_stock = true WHERE id = p_id AND user_id = v_op.user_id;
  ELSIF p_kind = 'preparation' THEN
    UPDATE public.preparations SET is_out_of_stock = true WHERE id = p_id AND user_id = v_op.user_id;
  ELSE
    RETURN jsonb_build_object('ok',false,'error','kind');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.operator_admin_create_expiry_nc(
  p_operator_id uuid, p_pin text, p_title text, p_description text, p_severity text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_op record;
  v_expected text;
  v_id uuid;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;
  IF NOT FOUND OR NOT v_op.is_active THEN RETURN jsonb_build_object('ok',false,'error','operator'); END IF;
  IF NOT v_op.is_admin THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN RETURN jsonb_build_object('ok',false,'error','pin'); END IF;

  INSERT INTO public.non_conformities (user_id, area, severity, title, description, status)
  VALUES (v_op.user_id, 'scadenza', COALESCE(NULLIF(p_severity,''),'medium'), p_title, p_description, 'open')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
