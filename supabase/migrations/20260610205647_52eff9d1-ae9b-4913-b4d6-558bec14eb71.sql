
-- 1) Funzione atomica per utenti autenticati
CREATE OR REPLACE FUNCTION public.create_product_with_blast(
  p_name text,
  p_production_date date,
  p_internal_lot text,
  p_notes text,
  p_department_id uuid,
  p_meat_type text,
  p_preservation_type text,
  p_requires_blast_chilling boolean,
  p_manual_ingredients text,
  p_expiry_date date,
  p_raw_material_ids uuid[],
  p_blast_cycle_type text,
  p_blast_notes text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prod_id uuid;
  v_rm uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  INSERT INTO public.products (
    user_id, name, production_date, internal_lot, notes,
    department_id, meat_type, preservation_type,
    requires_blast_chilling, manual_ingredients, expiry_date
  ) VALUES (
    v_uid, p_name, p_production_date, p_internal_lot, NULLIF(p_notes,''),
    p_department_id, NULLIF(p_meat_type,''), COALESCE(NULLIF(p_preservation_type,''),'vacuum'),
    COALESCE(p_requires_blast_chilling, false), NULLIF(p_manual_ingredients,''), p_expiry_date
  ) RETURNING id INTO v_prod_id;

  IF p_raw_material_ids IS NOT NULL THEN
    FOREACH v_rm IN ARRAY p_raw_material_ids LOOP
      INSERT INTO public.product_ingredients (user_id, product_id, raw_material_id)
      VALUES (v_uid, v_prod_id, v_rm);
    END LOOP;
  END IF;

  IF COALESCE(p_requires_blast_chilling, false) THEN
    INSERT INTO public.blast_chillings (
      user_id, product_name, cycle_type, outcome, notes, product_id
    ) VALUES (
      v_uid, p_name,
      COALESCE(NULLIF(p_blast_cycle_type,''), 'positive'),
      'ok', NULLIF(p_blast_notes,''), v_prod_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_prod_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_product_with_blast(
  text, date, text, text, uuid, text, text, boolean, text, date, uuid[], text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_with_blast(
  text, date, text, text, uuid, text, text, boolean, text, date, uuid[], text, text
) TO authenticated;

-- 2) Aggiorna operator_admin_insert_product per gestire l'abbattimento atomicamente
CREATE OR REPLACE FUNCTION public.operator_admin_insert_product(
  p_operator_id uuid,
  p_pin text,
  p_name text,
  p_production_date date,
  p_internal_lot text,
  p_notes text,
  p_department_id uuid,
  p_meat_type text,
  p_raw_material_ids uuid[],
  p_preservation_type text DEFAULT 'vacuum'::text,
  p_expiry_date date DEFAULT NULL,
  p_requires_blast_chilling boolean DEFAULT false,
  p_blast_cycle_type text DEFAULT 'positive',
  p_blast_notes text DEFAULT NULL,
  p_manual_ingredients text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
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

  INSERT INTO public.products (
    user_id, name, production_date, internal_lot, notes,
    department_id, meat_type, operator_id, preservation_type,
    requires_blast_chilling, manual_ingredients, expiry_date
  ) VALUES (
    v_op.user_id, p_name, p_production_date, p_internal_lot, NULLIF(p_notes,''),
    p_department_id, NULLIF(p_meat_type,''), v_op.id,
    COALESCE(NULLIF(p_preservation_type,''),'vacuum'),
    COALESCE(p_requires_blast_chilling, false),
    NULLIF(p_manual_ingredients,''),
    p_expiry_date
  ) RETURNING id INTO v_prod_id;

  IF p_raw_material_ids IS NOT NULL THEN
    FOREACH v_rm IN ARRAY p_raw_material_ids LOOP
      INSERT INTO public.product_ingredients (user_id, product_id, raw_material_id)
      VALUES (v_op.user_id, v_prod_id, v_rm);
    END LOOP;
  END IF;

  IF COALESCE(p_requires_blast_chilling, false) THEN
    INSERT INTO public.blast_chillings (
      user_id, operator_id, product_name, cycle_type, outcome, notes, product_id
    ) VALUES (
      v_op.user_id, v_op.id, p_name,
      COALESCE(NULLIF(p_blast_cycle_type,''), 'positive'),
      'ok', NULLIF(p_blast_notes,''), v_prod_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_prod_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
