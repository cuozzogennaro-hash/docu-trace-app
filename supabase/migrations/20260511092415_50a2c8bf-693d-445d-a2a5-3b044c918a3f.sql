-- Extend operator_admin_list to also return departments and label_templates
CREATE OR REPLACE FUNCTION public.operator_admin_list(p_operator_id uuid, p_pin text, p_table text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_op record;
  v_expected text;
  v_result jsonb;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin
  INTO v_op FROM public.operators WHERE id = p_operator_id LIMIT 1;

  IF NOT FOUND OR NOT v_op.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'operator');
  END IF;
  IF NOT v_op.is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pin');
  END IF;

  IF p_table = 'raw_materials' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_result
    FROM (SELECT * FROM public.raw_materials WHERE user_id = v_op.user_id ORDER BY created_at DESC LIMIT 500) r;
  ELSIF p_table = 'products' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_result
    FROM (SELECT * FROM public.products WHERE user_id = v_op.user_id ORDER BY created_at DESC LIMIT 500) r;
  ELSIF p_table = 'temperatures' THEN
    SELECT COALESCE(jsonb_agg(row_to_jsonb(x)), '[]'::jsonb) INTO v_result
    FROM (SELECT t.*, jsonb_build_object('name', a.name) AS assets
          FROM public.temperatures t LEFT JOIN public.assets a ON a.id = t.asset_id
          WHERE t.user_id = v_op.user_id ORDER BY t.recorded_at DESC LIMIT 500) x;
  ELSIF p_table = 'sanitations' THEN
    SELECT COALESCE(jsonb_agg(row_to_jsonb(x)), '[]'::jsonb) INTO v_result
    FROM (SELECT s.*, jsonb_build_object('name', a.name) AS assets
          FROM public.sanitations s LEFT JOIN public.assets a ON a.id = s.asset_id
          WHERE s.user_id = v_op.user_id ORDER BY s.recorded_at DESC LIMIT 500) x;
  ELSIF p_table = 'departments' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sort_order, r.name), '[]'::jsonb) INTO v_result
    FROM public.departments r WHERE r.user_id = v_op.user_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_table');
  END IF;

  RETURN jsonb_build_object('ok', true, 'rows', v_result);
END;
$function$;

-- RPC for admin-operator to register incoming raw materials (bulk insert)
CREATE OR REPLACE FUNCTION public.operator_admin_insert_raw_materials(
  p_operator_id uuid, p_pin text, p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_op record;
  v_expected text;
  v_row jsonb;
  v_count int := 0;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;
  IF NOT FOUND OR NOT v_op.is_active THEN RETURN jsonb_build_object('ok',false,'error','operator'); END IF;
  IF NOT v_op.is_admin THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN RETURN jsonb_build_object('ok',false,'error','pin'); END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.raw_materials (
      user_id, supplier_name, document_date, document_number, product_name,
      supplier_lot, internal_lot, quantity, expiry_date, origin, category,
      department_id, born_in, raised_in, slaughtered_in, slaughter_mark, ingredients,
      operator_id
    ) VALUES (
      v_op.user_id,
      NULLIF(v_row->>'supplier_name',''),
      NULLIF(v_row->>'document_date','')::date,
      NULLIF(v_row->>'document_number',''),
      v_row->>'product_name',
      NULLIF(v_row->>'supplier_lot',''),
      v_row->>'internal_lot',
      NULLIF(v_row->>'quantity',''),
      NULLIF(v_row->>'expiry_date','')::date,
      NULLIF(v_row->>'origin',''),
      COALESCE(NULLIF(v_row->>'category',''),'materia_prima'),
      NULLIF(v_row->>'department_id','')::uuid,
      NULLIF(v_row->>'born_in',''),
      NULLIF(v_row->>'raised_in',''),
      NULLIF(v_row->>'slaughtered_in',''),
      NULLIF(v_row->>'slaughter_mark',''),
      NULLIF(v_row->>'ingredients',''),
      v_op.id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', v_count);
END;
$$;