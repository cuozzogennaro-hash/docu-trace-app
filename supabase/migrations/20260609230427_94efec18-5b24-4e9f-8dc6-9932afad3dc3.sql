-- 1) consulenti_partner: aggiungi has_role check anche in USING
DROP POLICY IF EXISTS "Consulente manages own partner row" ON public.consulenti_partner;
CREATE POLICY "Consulente manages own partner row"
  ON public.consulenti_partner
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'consulente'::app_role))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'consulente'::app_role));

-- 2) operators: nascondi pin_hash e push_token dalla SELECT via Data API
REVOKE SELECT (pin_hash, push_token) ON public.operators FROM authenticated;
REVOKE SELECT (pin_hash, push_token) ON public.operators FROM anon;