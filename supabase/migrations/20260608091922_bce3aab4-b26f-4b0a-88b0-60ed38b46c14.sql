ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS scale_department_code integer;

ALTER TABLE public.scales_queue
  ADD COLUMN IF NOT EXISTS department_code integer,
  ADD COLUMN IF NOT EXISTS born_in text,
  ADD COLUMN IF NOT EXISTS raised_in text,
  ADD COLUMN IF NOT EXISTS slaughtered_in text,
  ADD COLUMN IF NOT EXISTS slaughterhouse_cee text,
  ADD COLUMN IF NOT EXISTS supplier_lot text;