
CREATE TABLE public.consulenti_partner (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  codice_partner text NOT NULL UNIQUE,
  studio_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consulenti_partner TO authenticated;
GRANT ALL ON public.consulenti_partner TO service_role;

ALTER TABLE public.consulenti_partner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consulente manages own partner row"
ON public.consulenti_partner FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'consulente'));

CREATE TRIGGER touch_consulenti_partner_updated_at
BEFORE UPDATE ON public.consulenti_partner
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consulente_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_consulente_id ON public.profiles(consulente_id);

CREATE POLICY "Consulente can view linked client profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (consulente_id = auth.uid() AND public.has_role(auth.uid(), 'consulente'));
