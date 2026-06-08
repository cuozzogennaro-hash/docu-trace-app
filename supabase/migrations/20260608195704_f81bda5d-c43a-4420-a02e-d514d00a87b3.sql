CREATE TABLE public.scales_lotti_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  scale_slot_number integer NOT NULL CHECK (scale_slot_number BETWEEN 1 AND 10),
  lot_code text,
  born_in text,
  raised_in text,
  slaughtered_in text,
  slaughterhouse_cee text,
  department_code integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scales_lotti_queue TO authenticated;
GRANT ALL ON public.scales_lotti_queue TO service_role;

ALTER TABLE public.scales_lotti_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own store lotti queue" ON public.scales_lotti_queue
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = scales_lotti_queue.store_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = scales_lotti_queue.store_id AND s.user_id = auth.uid()));

CREATE TRIGGER scales_lotti_queue_touch
  BEFORE UPDATE ON public.scales_lotti_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX scales_lotti_queue_store_status_idx ON public.scales_lotti_queue (store_id, status);