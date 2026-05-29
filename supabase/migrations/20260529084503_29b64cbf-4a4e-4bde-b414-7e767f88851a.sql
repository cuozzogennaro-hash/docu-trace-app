INSERT INTO public.products (
  user_id, operator_id, name, production_date, internal_lot,
  department_id, preservation_type, requires_blast_chilling,
  manual_ingredients, notes, created_at
)
SELECT
  p.user_id,
  p.operator_id,
  p.name,
  (p.prepared_at AT TIME ZONE 'UTC')::date,
  COALESCE(
    (regexp_match(p.notes, 'Lotto\s+([A-Za-z0-9\-]+)'))[1],
    to_char(p.prepared_at, 'DDMMYY') || '-XX'
  ),
  d.id,
  CASE p.storage_type
    WHEN 'freezer' THEN 'surgelato'
    WHEN 'ambiente' THEN 'fresh'
    ELSE 'refrigerato'
  END,
  false,
  p.ingredients_text,
  NULLIF(regexp_replace(COALESCE(p.notes, ''), '\s*•?\s*Lotto\s+[A-Za-z0-9\-]+\s*$', ''), ''),
  p.created_at
FROM public.preparations p
JOIN public.departments d
  ON d.user_id = p.user_id
 AND lower(trim(d.name)) = 'cucina'
WHERE NOT EXISTS (
  SELECT 1 FROM public.products pr
  WHERE pr.user_id = p.user_id
    AND pr.name = p.name
    AND pr.internal_lot = COALESCE(
      (regexp_match(p.notes, 'Lotto\s+([A-Za-z0-9\-]+)'))[1],
      to_char(p.prepared_at, 'DDMMYY') || '-XX'
    )
);