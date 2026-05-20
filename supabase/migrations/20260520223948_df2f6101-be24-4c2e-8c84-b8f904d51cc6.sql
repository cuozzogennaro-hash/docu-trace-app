
-- Abbattimenti
CREATE TABLE public.blast_chillings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  operator_id uuid,
  asset_id uuid,
  product_name text NOT NULL,
  cycle_type text NOT NULL DEFAULT 'positive', -- 'positive' | 'negative'
  temp_start numeric,
  temp_end numeric,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  outcome text NOT NULL DEFAULT 'ok', -- 'ok' | 'anomaly'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blast_chillings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own blast_chillings"
ON public.blast_chillings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_blast_chillings_user_started ON public.blast_chillings(user_id, started_at DESC);

-- Preparati / mise en place
CREATE TABLE public.preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  operator_id uuid,
  name text NOT NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  internal_expiry timestamptz NOT NULL,
  storage_type text NOT NULL DEFAULT 'frigo', -- 'frigo' | 'freezer' | 'ambiente'
  allergen_ids uuid[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preparations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own preparations"
ON public.preparations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_preparations_user_prepared ON public.preparations(user_id, prepared_at DESC);
