
-- Add intake temperature tracking to raw_materials
ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS intake_temperature numeric,
  ADD COLUMN IF NOT EXISTS intake_temp_compliant boolean,
  ADD COLUMN IF NOT EXISTS intake_storage_mode text;

-- Add recipe-specific fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS requires_blast_chilling boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_ingredients text;

-- Link blast_chillings to a product (optional)
ALTER TABLE public.blast_chillings
  ADD COLUMN IF NOT EXISTS product_id uuid;

-- Seed cucina label rules for existing users (clone from macelleria_preparato semantics)
INSERT INTO public.label_rules (user_id, department_key, rule_key, title, description, params, sort_order)
SELECT DISTINCT p.id, 'cucina', 'notice', 'Avviso conservazione',
       'Testo informativo stampato sopra la riga data/lotto.',
       jsonb_build_object('text', 'Conservare in frigorifero — Consumare previa cottura'), 10
FROM public.profiles p
ON CONFLICT (user_id, department_key, rule_key) DO NOTHING;

INSERT INTO public.label_rules (user_id, department_key, rule_key, title, description, params, sort_order)
SELECT DISTINCT p.id, 'cucina', 'ingredients', 'Ingredienti',
       'Elenco completo degli ingredienti con allergeni in grassetto e additivi (E…).',
       '{}'::jsonb, 20
FROM public.profiles p
ON CONFLICT (user_id, department_key, rule_key) DO NOTHING;

INSERT INTO public.label_rules (user_id, department_key, rule_key, title, description, params, sort_order)
SELECT DISTINCT p.id, 'cucina', 'shelf_life', 'Scadenza',
       'Scadenza calcolata in ore/giorni dalla data di produzione (modificabile in stampa).',
       jsonb_build_object('hours_default', 72), 30
FROM public.profiles p
ON CONFLICT (user_id, department_key, rule_key) DO NOTHING;

-- Update the seed function so future users also get cucina rules
CREATE OR REPLACE FUNCTION public.seed_label_rules_for_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.label_rules (user_id, department_key, rule_key, title, description, params, sort_order) VALUES
    (p_user_id, 'common', 'header', 'Intestazione azienda',
      'In alto vengono sempre stampati ragione sociale e indirizzo completo (via — città).',
      '{}'::jsonb, 10),
    (p_user_id, 'common', 'allergens', 'Evidenziazione allergeni',
      'L''elenco delle parole evidenziate in grassetto nell''elenco ingredienti è gestito nella scheda "Allergeni" in Impostazioni. Da qui puoi solo attivare o disattivare l''evidenziazione complessiva.',
      jsonb_build_object('enabled', true), 20),
    (p_user_id, 'common', 'additives', 'Additivi (sigle E…)',
      'In etichetta vengono stampate solo le sigle E… (in grassetto) inserite nel campo "ingredienti" dell''additivo, non il nome commerciale.',
      '{}'::jsonb, 30),
    (p_user_id, 'macelleria_fresh', 'notice', 'Avviso conservazione',
      'Testo informativo stampato sopra la riga data/lotto.',
      jsonb_build_object('text', 'Conservare da 0° e +4° — Consumare previa cottura'), 10),
    (p_user_id, 'macelleria_fresh', 'lot', 'Lotto stampato',
      'Per la carne fresca monocomponente il lotto stampato è quello del fornitore (inserito in ingresso merce), non il lotto interno.',
      '{}'::jsonb, 20),
    (p_user_id, 'macelleria_fresh', 'trace', 'Tracciabilità',
      'In etichetta vengono stampate le righe Nato in / Allevato in / Macellato in + Bollo CE, prese dalla scheda della materia prima.',
      '{}'::jsonb, 30),
    (p_user_id, 'macelleria_fresh', 'ingredients', 'Ingredienti',
      'L''elenco ingredienti non viene stampato (prodotto monocomponente).',
      '{}'::jsonb, 40),
    (p_user_id, 'macelleria_preparato', 'notice', 'Avviso conservazione',
      'Testo informativo stampato sopra la riga data/lotto.',
      jsonb_build_object('text', 'Conservare da 0° e +4° — Consumare previa cottura'), 10),
    (p_user_id, 'macelleria_preparato', 'origin', 'Origine carne',
      'Se tutte le materie prime sono di origine italiana viene stampato "Carne origine: IT", altrimenti "UE".',
      '{}'::jsonb, 20),
    (p_user_id, 'macelleria_preparato', 'ingredients', 'Ingredienti',
      'Elenco con "carne di <specie> (origine)" e gli altri ingredienti selezionati.',
      '{}'::jsonb, 30),
    (p_user_id, 'salumeria', 'shelf_life', 'Scadenza automatica',
      'Scadenza calcolata dalla data di produzione: numero di giorni distinto tra prodotto Fresco e prodotto Sottovuoto. Il tipo di conservazione si imposta sulla scheda prodotto e può essere modificato al momento della stampa.',
      jsonb_build_object('days_fresh', 5, 'days_vacuum', 30), 10),
    (p_user_id, 'salumeria', 'ingredients', 'Composizione ingredienti',
      'Per ogni materia prima viene stampato il nome del prodotto seguito, tra parentesi, dai suoi sotto-ingredienti.',
      '{}'::jsonb, 20),
    (p_user_id, 'ortofrutta', 'format', 'Formato standard',
      'Layout: intestazione + nome prodotto + ingredienti + data produzione + lotto + scadenza.',
      '{}'::jsonb, 10),
    (p_user_id, 'cucina', 'notice', 'Avviso conservazione',
      'Testo informativo stampato sopra la riga data/lotto.',
      jsonb_build_object('text', 'Conservare in frigorifero — Consumare previa cottura'), 10),
    (p_user_id, 'cucina', 'ingredients', 'Ingredienti',
      'Elenco completo degli ingredienti con allergeni in grassetto e additivi (E…).',
      '{}'::jsonb, 20),
    (p_user_id, 'cucina', 'shelf_life', 'Scadenza',
      'Scadenza calcolata in ore/giorni dalla data di produzione (modificabile in stampa).',
      jsonb_build_object('hours_default', 72), 30)
  ON CONFLICT (user_id, department_key, rule_key) DO NOTHING;
END;
$function$;
