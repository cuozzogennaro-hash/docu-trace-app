
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token jsonb;

ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS due_time time;
