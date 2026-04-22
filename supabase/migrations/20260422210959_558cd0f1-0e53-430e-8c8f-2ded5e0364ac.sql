-- Add cleaning product to assets
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS cleaning_product text;

-- Task assignments (operator -> asset, with type and frequency)
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  operator_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('sanitation','temperature')),
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','monthly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_id, asset_id, task_type)
);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own task_assignments"
ON public.task_assignments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_assignments_operator ON public.task_assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON public.task_assignments(user_id);