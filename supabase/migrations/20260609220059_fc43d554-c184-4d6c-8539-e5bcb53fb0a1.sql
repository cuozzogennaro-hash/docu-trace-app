
-- Allow super_admin to read all partner rows
CREATE POLICY "Super admin can view all partners"
ON public.consulenti_partner
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Promote a user to consulente partner (super_admin only)
CREATE OR REPLACE FUNCTION public.super_admin_promote_partner(
  p_user_id uuid,
  p_studio_name text,
  p_codice_partner text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_studio text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_code := upper(trim(coalesce(p_codice_partner, '')));
  v_studio := trim(coalesce(p_studio_name, ''));

  IF v_code = '' OR v_studio = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  IF EXISTS (SELECT 1 FROM public.consulenti_partner WHERE upper(codice_partner) = v_code AND user_id <> p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_taken');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'consulente')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.consulenti_partner (user_id, studio_name, codice_partner)
  VALUES (p_user_id, v_studio, v_code)
  ON CONFLICT (user_id) DO UPDATE
    SET studio_name = EXCLUDED.studio_name,
        codice_partner = EXCLUDED.codice_partner,
        updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
