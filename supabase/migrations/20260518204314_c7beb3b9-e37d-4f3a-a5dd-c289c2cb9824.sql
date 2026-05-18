
-- 1. Colonna su products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS preservation_type text NOT NULL DEFAULT 'vacuum';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_preservation_type_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_preservation_type_check
  CHECK (preservation_type IN ('fresh','vacuum'));

-- 2. Migra le regole salumeria.shelf_life esistenti
UPDATE public.label_rules
SET params = jsonb_build_object(
  'days_fresh', COALESCE((params->>'days_fresh')::int, 5),
  'days_vacuum', COALESCE((params->>'days_vacuum')::int, (params->>'days')::int, 30)
)
WHERE department_key = 'salumeria' AND rule_key = 'shelf_life';

-- 3. Aggiorna la funzione di seed per nuovi utenti
CREATE OR REPLACE FUNCTION public.seed_label_rules_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.label_rules (user_id, department_key, rule_key, title, description, params, sort_order) VALUES
    (p_user_id, 'common', 'header', 'Intestazione azienda',
      'In alto vengono sempre stampati ragione sociale e indirizzo completo (via — città).',
      '{}'::jsonb, 10),
    (p_user_id, 'common', 'allergens', 'Evidenziazione allergeni',
      'Le parole indicate qui sotto (e i loro derivati) vengono evidenziate in grassetto ovunque compaiano nell''elenco ingredienti, come richiesto dal Reg. UE 1169/2011.',
      jsonb_build_object(
        'enabled', true,
        'keywords', ARRAY[
          'glutine','grano','frumento','segale','orzo','avena','farro','kamut','spelta',
          'crostacei','gamberi','scampi','granchio','aragosta',
          'uova','uovo','albume','tuorlo',
          'pesce','salmone','tonno','merluzzo','acciughe','sardine',
          'arachidi','arachide',
          'soia','tofu',
          'latte','lattosio','burro','panna','formaggio','mozzarella','yogurt','ricotta','caseina',
          'mandorle','nocciole','noci','pistacchi','anacardi','pecan','macadamia',
          'sedano','senape','sesamo',
          'solfiti','anidride solforosa','SO2','E220','E221','E222','E223','E224','E225','E226','E227','E228',
          'lupini','lupino',
          'molluschi','vongole','cozze','calamari','polpo','seppia','ostriche'
        ]
      ), 20),
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
      '{}'::jsonb, 10)
  ON CONFLICT (user_id, department_key, rule_key) DO NOTHING;
END;
$$;

-- 4. Aggiorna RPC operator_admin_insert_product per accettare preservation_type
CREATE OR REPLACE FUNCTION public.operator_admin_insert_product(
  p_operator_id uuid, p_pin text, p_name text, p_production_date date,
  p_internal_lot text, p_notes text, p_department_id uuid, p_meat_type text,
  p_raw_material_ids uuid[], p_preservation_type text DEFAULT 'vacuum'
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_op record;
  v_expected text;
  v_prod_id uuid;
  v_rm uuid;
BEGIN
  SELECT id, user_id, pin_hash, is_active, is_admin INTO v_op
  FROM public.operators WHERE id = p_operator_id LIMIT 1;
  IF NOT FOUND OR NOT v_op.is_active THEN RETURN jsonb_build_object('ok',false,'error','operator'); END IF;
  IF NOT v_op.is_admin THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  v_expected := encode(extensions.digest(v_op.user_id::text || '::' || p_pin, 'sha256'), 'hex');
  IF v_expected <> v_op.pin_hash THEN RETURN jsonb_build_object('ok',false,'error','pin'); END IF;

  INSERT INTO public.products (user_id, name, production_date, internal_lot, notes, department_id, meat_type, operator_id, preservation_type)
  VALUES (v_op.user_id, p_name, p_production_date, p_internal_lot, NULLIF(p_notes,''), p_department_id, NULLIF(p_meat_type,''), v_op.id, COALESCE(NULLIF(p_preservation_type,''),'vacuum'))
  RETURNING id INTO v_prod_id;

  IF p_raw_material_ids IS NOT NULL THEN
    FOREACH v_rm IN ARRAY p_raw_material_ids LOOP
      INSERT INTO public.product_ingredients (user_id, product_id, raw_material_id)
      VALUES (v_op.user_id, v_prod_id, v_rm);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_prod_id);
END;
$function$;
