CREATE TABLE public.recurring_raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_name text NOT NULL,
  supplier_name text,
  category text NOT NULL DEFAULT 'materia_prima',
  department_id uuid,
  quantity text,
  origin text,
  ingredients text,
  born_in text,
  raised_in text,
  slaughtered_in text,
  slaughter_mark text,
  use_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own recurring_raw_materials"
ON public.recurring_raw_materials
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_recurring_raw_materials_updated
BEFORE UPDATE ON public.recurring_raw_materials
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_recurring_raw_materials_user ON public.recurring_raw_materials(user_id, last_used_at DESC NULLS LAST);