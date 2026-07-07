
-- Explicit write lockdown on user_roles for anon/authenticated (service_role bypasses RLS)
CREATE POLICY "Deny role inserts from clients"
  ON public.user_roles FOR INSERT TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Deny role updates from clients"
  ON public.user_roles FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny role deletes from clients"
  ON public.user_roles FOR DELETE TO anon, authenticated
  USING (false);

-- Explicit public read policy for the logos bucket (replaces reliance on bucket public flag)
CREATE POLICY "Public read logos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'logos');
