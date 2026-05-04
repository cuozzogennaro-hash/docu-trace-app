
-- Add is_admin column
ALTER TABLE public.operators ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

-- Update operator_login to return is_admin
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
  SELECT id, name, role, user_id, pin_hash, is_active, is_admin
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
    'admin_user_id', v_op.user_id,
    'is_admin', v_op.is_admin
  );
END;
$function$;
