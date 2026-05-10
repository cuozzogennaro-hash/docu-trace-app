ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS meat_type text,
  ADD COLUMN IF NOT EXISTS slaughter_mark text;