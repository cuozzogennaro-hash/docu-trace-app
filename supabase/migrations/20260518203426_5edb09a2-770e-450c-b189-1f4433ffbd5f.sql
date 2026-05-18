
CREATE TABLE public.label_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_key text NOT NULL,
  rule_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_key, rule_key)
);

ALTER TABLE public.label_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own label_rules"
  ON public.label_rules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER label_rules_touch
  BEFORE UPDATE ON public.label_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: seed delle regole standard per un utente
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
      'Scadenza calcolata come data produzione + N giorni.',
      jsonb_build_object('days', 30), 10),
    (p_user_id, 'salumeria', 'ingredients', 'Composizione ingredienti',
      'Per ogni materia prima viene stampato il nome del prodotto seguito, tra parentesi, dai suoi sotto-ingredienti.',
      '{}'::jsonb, 20),
    (p_user_id, 'ortofrutta', 'format', 'Formato standard',
      'Layout: intestazione + nome prodotto + ingredienti + data produzione + lotto + scadenza.',
      '{}'::jsonb, 10)
  ON CONFLICT (user_id, department_key, rule_key) DO NOTHING;
END;
$$;

-- Trigger di seed alla creazione di un nuovo profilo
CREATE OR REPLACE FUNCTION public.seed_label_rules_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_label_rules_for_user(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_label_rules_after_profile_insert
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_label_rules_on_profile();

-- Seed immediato per gli utenti già esistenti
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT id FROM public.profiles LOOP
    PERFORM public.seed_label_rules_for_user(u);
  END LOOP;
END $$;
