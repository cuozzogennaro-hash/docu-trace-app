ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS health_cert_expiry date,
  ADD COLUMN IF NOT EXISTS health_cert_reminder_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS hide_in_reports boolean NOT NULL DEFAULT false;