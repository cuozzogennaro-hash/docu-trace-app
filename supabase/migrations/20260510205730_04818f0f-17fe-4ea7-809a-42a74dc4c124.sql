ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS born_in text,
  ADD COLUMN IF NOT EXISTS raised_in text,
  ADD COLUMN IF NOT EXISTS slaughtered_in text;