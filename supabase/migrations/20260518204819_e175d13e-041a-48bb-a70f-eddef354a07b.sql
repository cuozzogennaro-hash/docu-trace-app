
-- 1) Tabella allergens
CREATE TABLE public.allergens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own allergens" ON public.allergens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER allergens_touch_updated_at
  BEFORE UPDATE ON public.allergens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_allergens_user ON public.allergens(user_id);

-- 2) Funzione di seed per gli allergeni di legge
CREATE OR REPLACE FUNCTION public.seed_allergens_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.allergens (user_id, name, keywords, sort_order) VALUES
    (p_user_id, 'Glutine', ARRAY['glutine','grano','frumento','segale','orzo','avena','farro','kamut','khorasan','spelta','seitan','malto'], 10),
    (p_user_id, 'Crostacei', ARRAY['crostacei','gambero','gamberi','gamberetti','scampi','scampo','granchio','granchi','aragosta','aragoste'], 20),
    (p_user_id, 'Uova', ARRAY['uova','uovo','albume','tuorlo','ovoprodotti'], 30),
    (p_user_id, 'Pesce', ARRAY['pesce','salmone','tonno','merluzzo','baccalà','sgombro','acciuga','acciughe','alici','sardina','sardine','spigola','branzino','orata','trota','nasello'], 40),
    (p_user_id, 'Arachidi', ARRAY['arachide','arachidi'], 50),
    (p_user_id, 'Soia', ARRAY['soia','tofu','edamame'], 60),
    (p_user_id, 'Latte', ARRAY['latte','lattosio','burro','panna','formaggio','mozzarella','yogurt','ricotta','caseina','caseinato','siero','stracchino','parmigiano','grana','scamorza','provolone'], 70),
    (p_user_id, 'Frutta a guscio', ARRAY['mandorla','mandorle','nocciola','nocciole','noce','noci','pistacchio','pistacchi','anacardo','anacardi','pecan','macadamia'], 80),
    (p_user_id, 'Sedano', ARRAY['sedano'], 90),
    (p_user_id, 'Senape', ARRAY['senape'], 100),
    (p_user_id, 'Sesamo', ARRAY['sesamo'], 110),
    (p_user_id, 'Solfiti / Anidride solforosa', ARRAY['solfiti','solfito','so2','anidride solforosa','e220','e221','e222','e223','e224','e225','e226','e227','e228'], 120),
    (p_user_id, 'Lupini', ARRAY['lupino','lupini'], 130),
    (p_user_id, 'Molluschi', ARRAY['mollusco','molluschi','vongola','vongole','cozza','cozze','calamaro','calamari','polpo','polpi','seppia','seppie','ostrica','ostriche','lumaca','lumache'], 140)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 3) Trigger: seed automatico per nuovi profili
CREATE OR REPLACE FUNCTION public.seed_allergens_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_allergens_for_user(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_allergens_after_profile ON public.profiles;
CREATE TRIGGER seed_allergens_after_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_allergens_on_profile();

-- 4) Seed per utenti esistenti
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_allergens_for_user(r.id);
  END LOOP;
END $$;

-- 5) Aggiorna descrizione regola "common.allergens" e svuota keywords (ora vivono nella tabella allergens)
UPDATE public.label_rules
SET description = 'L''elenco delle parole evidenziate in grassetto nell''elenco ingredienti è gestito nella scheda "Allergeni" in Impostazioni. Da qui puoi solo attivare o disattivare l''evidenziazione complessiva.',
    params = jsonb_build_object('enabled', COALESCE((params->>'enabled')::boolean, true))
WHERE rule_key = 'allergens' AND department_key = 'common';

-- 6) Aggiorna seed delle label_rules per i futuri utenti
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
      '{}'::jsonb, 10)
  ON CONFLICT (user_id, department_key, rule_key) DO NOTHING;
END;
$function$;
