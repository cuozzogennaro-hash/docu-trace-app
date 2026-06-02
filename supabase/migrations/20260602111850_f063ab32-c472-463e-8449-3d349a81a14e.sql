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
      supplier_lot, internal_lot, quantity, expiry_date, production_date, origin, category,
      department_id, born_in, raised_in, slaughtered_in, slaughter_mark, ingredients,
      operator_id
    ) VALUES (
      v_op.user_id,
      NULLIF(v_row->>'supplier_name',''),
      COALESCE(NULLIF(v_row->>'document_date','')::date, CURRENT_DATE),
      NULLIF(v_row->>'document_number',''),
      v_row->>'product_name',
      NULLIF(v_row->>'supplier_lot',''),
      v_row->>'internal_lot',
      NULLIF(v_row->>'quantity',''),
      NULLIF(v_row->>'expiry_date','')::date,
      NULLIF(v_row->>'production_date','')::date,
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