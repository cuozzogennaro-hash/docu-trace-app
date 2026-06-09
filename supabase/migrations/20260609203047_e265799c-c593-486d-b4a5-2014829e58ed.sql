
-- Permette al titolare collegato di vedere SOLO la riga del proprio consulente
CREATE POLICY "Linked client can view own consulente partner"
ON public.consulenti_partner
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.consulente_id = consulenti_partner.user_id
  )
);

-- Funzione di collegamento: il titolare passa il codice, l'app aggiorna il profilo
CREATE OR REPLACE FUNCTION public.link_consulente_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_consulente_user uuid;
  v_studio text;
  v_clean text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  v_clean := upper(trim(coalesce(p_code, '')));
  IF v_clean = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty');
  END IF;

  SELECT user_id, studio_name
    INTO v_consulente_user, v_studio
  FROM public.consulenti_partner
  WHERE upper(codice_partner) = v_clean
  LIMIT 1;

  IF v_consulente_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  UPDATE public.profiles
    SET consulente_id = v_consulente_user
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'studio_name', v_studio);
END;
$$;

REVOKE ALL ON FUNCTION public.link_consulente_by_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.link_consulente_by_code(text) TO authenticated;
