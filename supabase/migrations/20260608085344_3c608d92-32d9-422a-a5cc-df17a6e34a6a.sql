
-- ============ STORES ============
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  scale_integration_active boolean NOT NULL DEFAULT false,
  scale_api_key uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stores_user_id_idx ON public.stores(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own stores"
  ON public.stores FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER stores_touch_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PROFILES.store_id ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_store_id_idx ON public.profiles(store_id);

-- ============ BACK-FILL UTENTI ESISTENTI ============
-- Crea uno store di default per ogni profilo che non ne ha uno
WITH new_stores AS (
  INSERT INTO public.stores (user_id, name, scale_integration_active)
  SELECT p.id, 'Punto Vendita Principale', false
  FROM public.profiles p
  WHERE p.store_id IS NULL
  RETURNING id, user_id
)
UPDATE public.profiles p
SET store_id = ns.id
FROM new_stores ns
WHERE p.id = ns.user_id;

-- ============ SCALES_QUEUE ============
CREATE TABLE public.scales_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plu_code text NOT NULL,
  product_name text,
  lot_number text,
  ingredients text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scales_queue_store_status_idx ON public.scales_queue(store_id, status);
CREATE INDEX scales_queue_user_id_idx ON public.scales_queue(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scales_queue TO authenticated;
GRANT ALL ON public.scales_queue TO service_role;

ALTER TABLE public.scales_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own scales queue rows"
  ON public.scales_queue FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER scales_queue_touch_updated_at
  BEFORE UPDATE ON public.scales_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ handle_new_user: crea store di default ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);

  INSERT INTO public.stores (user_id, name, scale_integration_active)
  VALUES (NEW.id, 'Punto Vendita Principale', false)
  RETURNING id INTO v_store_id;

  UPDATE public.profiles SET store_id = v_store_id WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;
