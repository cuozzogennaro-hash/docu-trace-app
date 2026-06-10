ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS default_shelf_life_days integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry_date date;