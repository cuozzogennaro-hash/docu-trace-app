-- Menu allergeni
CREATE TABLE public.menu_dishes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  allergen_ids UUID[] NOT NULL DEFAULT '{}',
  price NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_dishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own menu_dishes" ON public.menu_dishes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_menu_dishes_user ON public.menu_dishes(user_id);
CREATE TRIGGER trg_menu_dishes_updated BEFORE UPDATE ON public.menu_dishes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Mantenimento caldo/freddo / rigenerazione
CREATE TABLE public.holding_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operator_id UUID,
  asset_id UUID,
  product_name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'hot', -- 'hot' | 'cold' | 'regeneration'
  temperature NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'anomaly'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.holding_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own holding_records" ON public.holding_records FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_holding_user_date ON public.holding_records(user_id, recorded_at DESC);

-- Controllo olio frittura
CREATE TABLE public.oil_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operator_id UUID,
  asset_id UUID,
  fryer_name TEXT,
  polar_compounds NUMERIC, -- %
  action TEXT NOT NULL DEFAULT 'check', -- 'check' | 'filter' | 'change'
  outcome TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'anomaly'
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oil_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own oil_checks" ON public.oil_checks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_oil_user_date ON public.oil_checks(user_id, checked_at DESC);

-- Non conformità
CREATE TABLE public.non_conformities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operator_id UUID,
  area TEXT NOT NULL DEFAULT 'altro', -- 'temperatura' | 'pulizia' | 'fornitore' | 'attrezzatura' | 'prodotto' | 'altro'
  severity TEXT NOT NULL DEFAULT 'low', -- 'low' | 'medium' | 'high'
  title TEXT NOT NULL,
  description TEXT,
  corrective_action TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.non_conformities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own non_conformities" ON public.non_conformities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_nc_user_status ON public.non_conformities(user_id, status, detected_at DESC);
CREATE TRIGGER trg_nc_updated BEFORE UPDATE ON public.non_conformities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();