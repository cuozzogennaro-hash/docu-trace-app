-- Table to store first-party page view analytics
CREATE TABLE public.page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NULL,
  session_id text NOT NULL,
  path text NOT NULL,
  referrer text NULL,
  device text NULL,
  user_agent text NULL,
  is_native boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX page_views_created_at_idx ON public.page_views (created_at DESC);
CREATE INDEX page_views_session_idx ON public.page_views (session_id, created_at);
CREATE INDEX page_views_path_idx ON public.page_views (path);

-- Grants: anon needs INSERT to track non-logged visitors; no SELECT for anyone (read only via SECURITY DEFINER RPC)
GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT ALL ON public.page_views TO service_role;

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert their own page view
CREATE POLICY "anyone can insert page views"
  ON public.page_views FOR INSERT
  WITH CHECK (true);

-- No direct SELECT — reads happen only via super_admin_traffic_overview RPC
CREATE POLICY "no direct select page views"
  ON public.page_views FOR SELECT
  USING (false);

-- Aggregated traffic stats, super_admin only
CREATE OR REPLACE FUNCTION public.super_admin_traffic_overview(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz;
  v_daily jsonb;
  v_top_pages jsonb;
  v_devices jsonb;
  v_totals jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  v_since := now() - (GREATEST(p_days, 1) || ' days')::interval;

  SELECT COALESCE(jsonb_agg(row_to_jsonb(d) ORDER BY d.day), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/Rome'), 'YYYY-MM-DD') AS day,
      COUNT(*) AS pageviews,
      COUNT(DISTINCT session_id) AS visitors
    FROM public.page_views
    WHERE created_at >= v_since
    GROUP BY 1
  ) d;

  SELECT COALESCE(jsonb_agg(row_to_jsonb(p) ORDER BY p.views DESC), '[]'::jsonb) INTO v_top_pages
  FROM (
    SELECT path AS label, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
    GROUP BY path
    ORDER BY COUNT(*) DESC
    LIMIT 15
  ) p;

  SELECT COALESCE(jsonb_agg(row_to_jsonb(d)), '[]'::jsonb) INTO v_devices
  FROM (
    SELECT COALESCE(device, 'unknown') AS label, COUNT(*) AS views
    FROM public.page_views
    WHERE created_at >= v_since
    GROUP BY 1
    ORDER BY COUNT(*) DESC
  ) d;

  SELECT jsonb_build_object(
    'pageviews', COUNT(*),
    'visitors', COUNT(DISTINCT session_id),
    'native_share', ROUND(100.0 * SUM(CASE WHEN is_native THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1), 1)
  ) INTO v_totals
  FROM public.page_views
  WHERE created_at >= v_since;

  RETURN jsonb_build_object(
    'ok', true,
    'since', v_since,
    'totals', v_totals,
    'daily', v_daily,
    'top_pages', v_top_pages,
    'devices', v_devices
  );
END;
$$;