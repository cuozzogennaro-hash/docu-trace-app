
-- 1) Restrict access to operator PIN hashes and push tokens
REVOKE SELECT (pin_hash, push_token) ON public.operators FROM anon, authenticated;

-- 2) Add server-side PIN verification RPC so clients never read pin_hash
CREATE OR REPLACE FUNCTION public.operator_verify_pin(p_operator_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_op record;
  v_expected text;
BEGIN
  SELECT id, name, role, user_id, pin_hash, is_active, is_admin
    INTO v_op FROM public.operators WHERE id = p_operator_id LIMIT 1;
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
    'is_active', v_op.is_active,
    'is_admin', v_op.is_admin
  );
END;
$$;

-- 3) Lock down SECURITY DEFINER function execute privileges:
--    revoke PUBLIC, grant only the roles that should call each function.

-- Trigger/internal helper functions: no direct callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.operators_fill_handle() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_allergens_on_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_departments() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_label_rules_on_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_allergens_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_label_rules_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_overdue_tasks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_overdue_tasks(uuid) TO service_role;

-- Operator login: callable by anon (login screen)
REVOKE EXECUTE ON FUNCTION public.operator_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_login(text, text) TO anon, authenticated;

-- Operator runtime RPCs: callable by anon/authenticated (operator session uses anon client)
REVOKE EXECUTE ON FUNCTION public.operator_verify_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_verify_pin(uuid, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_tasks(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_tasks(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_company(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_company(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_period_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_period_status(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_record_sanitation(uuid, text, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_record_sanitation(uuid, text, uuid, date) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_record_temperature(uuid, text, uuid, numeric, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_record_temperature(uuid, text, uuid, numeric, date) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.save_operator_push_token(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_operator_push_token(uuid, text, jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_admin_list(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_admin_list(uuid, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_admin_get_product(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_admin_get_product(uuid, text, uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_admin_get_raw_material(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_admin_get_raw_material(uuid, text, uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_admin_insert_raw_materials(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_admin_insert_raw_materials(uuid, text, jsonb) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_admin_insert_product(uuid, text, text, date, text, text, uuid, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_admin_insert_product(uuid, text, text, date, text, text, uuid, text, uuid[]) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.operator_admin_insert_product(uuid, text, text, date, text, text, uuid, text, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operator_admin_insert_product(uuid, text, text, date, text, text, uuid, text, uuid[], text) TO anon, authenticated;
