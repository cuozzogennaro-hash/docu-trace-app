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
    FROM (SELECT * FROM public.raw_materials WHERE user_id = v_op.user_id ORDER BY document_date DESC NULLS LAST, created_at DESC LIMIT 500) r;
  ELSIF p_table = 'products' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_result
    FROM (SELECT * FROM public.products WHERE user_id = v_op.user_id ORDER BY production_date DESC NULLS LAST, created_at DESC LIMIT 500) r;
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