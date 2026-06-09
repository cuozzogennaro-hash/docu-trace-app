CREATE OR REPLACE FUNCTION public.super_admin_revoke_partner(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM public.consulenti_partner WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = 'consulente';
  UPDATE public.profiles SET consulente_id = NULL WHERE consulente_id = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;