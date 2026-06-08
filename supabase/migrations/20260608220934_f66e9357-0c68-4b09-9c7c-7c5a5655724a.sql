DROP POLICY IF EXISTS "anyone can insert page views" ON public.page_views;
CREATE POLICY "anyone can insert page views"
  ON public.page_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());