-- Extend preparations with ingredient tracking
ALTER TABLE public.preparations
  ADD COLUMN IF NOT EXISTS raw_material_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS ingredients_text text;

-- Recurring recipes for kitchen
CREATE TABLE IF NOT EXISTS public.recurring_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  storage_type text NOT NULL DEFAULT 'frigo',
  shelf_hours integer NOT NULL DEFAULT 72,
  allergen_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  raw_material_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ingredients_text text,
  notes text,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_preparations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own recurring_preparations"
  ON public.recurring_preparations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_recurring_preparations_updated_at
  BEFORE UPDATE ON public.recurring_preparations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_recurring_preparations_user ON public.recurring_preparations(user_id, last_used_at DESC NULLS LAST);