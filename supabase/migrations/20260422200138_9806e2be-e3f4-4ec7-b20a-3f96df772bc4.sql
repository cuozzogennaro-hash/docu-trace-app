-- 1. company_settings: anagrafica azienda (1 riga per utente)
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  business_name text,
  vat text,
  address text,
  logo_url text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company_settings" ON public.company_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. operators: lista operatori con PIN (hash) per multi-operatore
CREATE TABLE public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  pin_hash text NOT NULL,
  role text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own operators" ON public.operators
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Aggiunta operator_id alle tabelle di registrazione
ALTER TABLE public.sanitations ADD COLUMN operator_id uuid;
ALTER TABLE public.temperatures ADD COLUMN operator_id uuid;
ALTER TABLE public.raw_materials ADD COLUMN operator_id uuid;
ALTER TABLE public.products ADD COLUMN operator_id uuid;

-- 4. Trigger updated_at per company_settings
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_company_settings_updated
BEFORE UPDATE ON public.company_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Storage bucket per i loghi (pubblico per visualizzazione facile)
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Users upload own logo" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own logo" ON storage.objects
  FOR UPDATE USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own logo" ON storage.objects
  FOR DELETE USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);