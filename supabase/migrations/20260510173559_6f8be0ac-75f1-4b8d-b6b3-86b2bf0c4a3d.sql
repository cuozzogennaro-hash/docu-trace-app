-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own departments"
ON public.departments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_departments_user ON public.departments(user_id);

CREATE TRIGGER trg_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add department_id to raw_materials and products (nullable for backward compat)
ALTER TABLE public.raw_materials ADD COLUMN department_id UUID;
ALTER TABLE public.products ADD COLUMN department_id UUID;

CREATE INDEX idx_raw_materials_department ON public.raw_materials(department_id);
CREATE INDEX idx_products_department ON public.products(department_id);

-- Seed default departments for every existing user
INSERT INTO public.departments (user_id, name, sort_order)
SELECT id, 'Macelleria', 0 FROM auth.users
UNION ALL
SELECT id, 'Salumeria', 1 FROM auth.users
UNION ALL
SELECT id, 'Ortofrutta', 2 FROM auth.users;

-- Trigger: when a new user signs up, create default departments automatically
CREATE OR REPLACE FUNCTION public.seed_default_departments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.departments (user_id, name, sort_order) VALUES
    (NEW.id, 'Macelleria', 0),
    (NEW.id, 'Salumeria', 1),
    (NEW.id, 'Ortofrutta', 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_seed_departments ON auth.users;
CREATE TRIGGER on_auth_user_created_seed_departments
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.seed_default_departments();