CREATE TABLE public.asl_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  original_pdf_path text NOT NULL,
  signed_pdf_path text,
  signed_uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asl_packages TO authenticated;
GRANT ALL ON public.asl_packages TO service_role;

ALTER TABLE public.asl_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own asl_packages"
ON public.asl_packages
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_asl_packages_user_created ON public.asl_packages(user_id, created_at DESC);