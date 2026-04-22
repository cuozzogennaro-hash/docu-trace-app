CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper to strip accents (limited but covers common Italian)
CREATE OR REPLACE FUNCTION public.unaccent_safe(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT translate(coalesce(input, ''),
    'àáâãäåèéêëìíîïòóôõöùúûüñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC')
$$;

CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(public.unaccent_safe(coalesce(input, ''))),
      '[^a-z0-9]+', '-', 'g'
    ),
    '(^-+|-+$)', '', 'g'
  )
$$;

ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS login_handle text;

UPDATE public.operators o
SET login_handle = (
  public.slugify(o.name) || '-' ||
  COALESCE(
    NULLIF(public.slugify(cs.business_name), ''),
    substr(o.user_id::text, 1, 6)
  )
)
FROM public.company_settings cs
WHERE cs.user_id = o.user_id AND o.login_handle IS NULL;

UPDATE public.operators
SET login_handle = public.slugify(name) || '-' || substr(user_id::text, 1, 6)
WHERE login_handle IS NULL;

ALTER TABLE public.operators ALTER COLUMN login_handle SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS operators_login_handle_unique ON public.operators(login_handle);

CREATE OR REPLACE FUNCTION public.operators_fill_handle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business text;
  v_base text;
  v_candidate text;
  v_n int := 0;
BEGIN
  IF NEW.login_handle IS NULL OR length(trim(NEW.login_handle)) = 0 THEN
    SELECT business_name INTO v_business FROM public.company_settings WHERE user_id = NEW.user_id LIMIT 1;
    v_base := public.slugify(NEW.name) || '-' || COALESCE(NULLIF(public.slugify(v_business), ''), substr(NEW.user_id::text, 1, 6));
    v_candidate := v_base;
    WHILE EXISTS (SELECT 1 FROM public.operators WHERE login_handle = v_candidate) LOOP
      v_n := v_n + 1;
      v_candidate := v_base || '-' || v_n::text;
    END LOOP;
    NEW.login_handle := v_candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operators_fill_handle ON public.operators;
CREATE TRIGGER trg_operators_fill_handle
BEFORE INSERT ON public.operators
FOR EACH ROW EXECUTE FUNCTION public.operators_fill_handle();

CREATE OR REPLACE FUNCTION public.operator_login(p_handle text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op record;
  v_expected text;
BEGIN
  SELECT id, name, role, user_id, pin_hash, is_active
  INTO v_op
  FROM public.operators
  WHERE login_handle = lower(trim(p_handle))
  LIMIT 1;

  IF NOT FOUND OR NOT v_op.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  v_expected := encode(digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');

  IF v_expected <> v_op.pin_hash THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'operator_id', v_op.id,
    'name', v_op.name,
    'role', v_op.role,
    'admin_user_id', v_op.user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.operator_login(text, text) TO anon, authenticated;