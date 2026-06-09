
CREATE POLICY "Consulenti can view assigned clients temperatures"
ON public.temperatures
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'consulente')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = temperatures.user_id
      AND p.consulente_id = auth.uid()
  )
);

CREATE POLICY "Consulenti can view assigned clients sanitations"
ON public.sanitations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'consulente')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = sanitations.user_id
      AND p.consulente_id = auth.uid()
  )
);

CREATE POLICY "Consulenti can view assigned clients assets"
ON public.assets
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'consulente')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = assets.user_id
      AND p.consulente_id = auth.uid()
  )
);
