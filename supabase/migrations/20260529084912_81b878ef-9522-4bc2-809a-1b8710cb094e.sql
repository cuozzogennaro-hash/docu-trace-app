INSERT INTO public.product_ingredients (user_id, product_id, raw_material_id)
SELECT DISTINCT pr.user_id, pr.id, rm_id
FROM public.products pr
JOIN public.departments d
  ON d.id = pr.department_id AND lower(trim(d.name)) = 'cucina'
JOIN public.preparations p
  ON p.user_id = pr.user_id
 AND p.name = pr.name
 AND (
   p.notes ILIKE '%Lotto ' || pr.internal_lot || '%'
 )
CROSS JOIN LATERAL unnest(p.raw_material_ids) AS rm_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_ingredients pi
  WHERE pi.product_id = pr.id AND pi.raw_material_id = rm_id
);