
CREATE OR REPLACE FUNCTION public.operator_admin_get_raw_material(p_operator_id uuid, p_pin text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE
  v_op record;
  v_expected text;
  v_mat jsonb;
  v_dept text;
  v_products jsonb;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;
  IF NOT FOUND OR NOT v_op.is_active THEN RETURN jsonb_build_object('ok',false,'error','operator'); END IF;
  IF NOT v_op.is_admin THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN RETURN jsonb_build_object('ok',false,'error','pin'); END IF;

  SELECT to_jsonb(r) INTO v_mat FROM public.raw_materials r
  WHERE r.id = p_id AND r.user_id = v_op.user_id;
  IF v_mat IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;

  SELECT name INTO v_dept FROM public.departments
  WHERE id = (v_mat->>'department_id')::uuid AND user_id = v_op.user_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.production_date DESC), '[]'::jsonb) INTO v_products
  FROM public.products p
  WHERE p.user_id = v_op.user_id
    AND p.id IN (SELECT product_id FROM public.product_ingredients WHERE raw_material_id = p_id AND user_id = v_op.user_id);

  RETURN jsonb_build_object('ok',true,'material',v_mat,'department_name',v_dept,'products',v_products);
END; $$;

CREATE OR REPLACE FUNCTION public.operator_admin_get_product(p_operator_id uuid, p_pin text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE
  v_op record;
  v_expected text;
  v_prod jsonb;
  v_ingredients jsonb;
  v_templates jsonb;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;
  IF NOT FOUND OR NOT v_op.is_active THEN RETURN jsonb_build_object('ok',false,'error','operator'); END IF;
  IF NOT v_op.is_admin THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN RETURN jsonb_build_object('ok',false,'error','pin'); END IF;

  SELECT to_jsonb(p) INTO v_prod FROM public.products p
  WHERE p.id = p_id AND p.user_id = v_op.user_id;
  IF v_prod IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(rm)), '[]'::jsonb) INTO v_ingredients
  FROM public.raw_materials rm
  WHERE rm.user_id = v_op.user_id
    AND rm.id IN (SELECT raw_material_id FROM public.product_ingredients WHERE product_id = p_id AND user_id = v_op.user_id);

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at), '[]'::jsonb) INTO v_templates
  FROM public.label_templates t WHERE t.user_id = v_op.user_id;

  RETURN jsonb_build_object('ok',true,'product',v_prod,'ingredients',v_ingredients,'label_templates',v_templates,'admin_user_id',v_op.user_id);
END; $$;
