ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS native_push_token text;
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS native_platform text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS native_push_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS native_platform text;

CREATE OR REPLACE FUNCTION public.save_operator_native_push_token(
  p_operator_id uuid,
  p_pin text,
  p_native_token text,
  p_platform text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_op record;
  v_expected text;
BEGIN
  SELECT id, user_id, pin_hash, is_active
  INTO v_op
  FROM public.operators
  WHERE id = p_operator_id
  LIMIT 1;

  IF NOT FOUND OR NOT v_op.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');

  IF v_expected <> v_op.pin_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  UPDATE public.operators
    SET native_push_token = p_native_token,
        native_platform = p_platform
  WHERE id = p_operator_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;