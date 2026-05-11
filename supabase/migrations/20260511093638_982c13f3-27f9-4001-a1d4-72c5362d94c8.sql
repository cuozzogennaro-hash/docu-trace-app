CREATE OR REPLACE FUNCTION public.operator_admin_insert_product(
  p_operator_id uuid,
  p_pin text,
  p_name text,
  p_production_date date,
  p_internal_lot text,
  p_notes text,
  p_department_id uuid,
  p_meat_type text,
  p_raw_material_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_op record;
  v_expected text;
  v_prod_id uuid;
  v_rm uuid;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;
  IF NOT FOUND OR NOT v_op.is_active THEN RETURN jsonb_build_object('ok',false,'error','operator'); END IF;
  IF NOT v_op.is_admin THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN RETURN jsonb_build_object('ok',false,'error','pin'); END IF;

  INSERT INTO public.products (user_id, name, production_date, internal_lot, notes, department_id, meat_type, operator_id)
  VALUES (v_op.user_id, p_name, p_production_date, p_internal_lot, NULLIF(p_notes,''), p_department_id, NULLIF(p_meat_type,''), v_op.id)
  RETURNING id INTO v_prod_id;

  IF p_raw_material_ids IS NOT NULL THEN
    FOREACH v_rm IN ARRAY p_raw_material_ids LOOP
      INSERT INTO public.product_ingredients (user_id, product_id, raw_material_id)
      VALUES (v_op.user_id, v_prod_id, v_rm);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_prod_id);
END;
$function$;