CREATE OR REPLACE FUNCTION public.seed_default_departments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.departments (user_id, name, sort_order) VALUES
    (NEW.id, 'Macelleria', 0),
    (NEW.id, 'Salumeria', 1),
    (NEW.id, 'Ortofrutta', 2);
  RETURN NEW;
END;
$function$;