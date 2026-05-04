
CREATE TABLE public.label_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Etichetta predefinita',
  width_mm numeric NOT NULL DEFAULT 100,
  height_mm numeric NOT NULL DEFAULT 70,
  layout_config jsonb NOT NULL DEFAULT '{
    "fields": [
      {"key": "company_name", "label": "Azienda", "visible": true, "x": 5, "y": 5, "fontSize": 12, "bold": true},
      {"key": "logo", "label": "Logo", "visible": true, "x": 70, "y": 2, "width": 25, "height": 15},
      {"key": "product_name", "label": "Prodotto", "visible": true, "x": 5, "y": 20, "fontSize": 14, "bold": true},
      {"key": "internal_lot", "label": "Lotto", "visible": true, "x": 5, "y": 32, "fontSize": 10, "bold": false},
      {"key": "production_date", "label": "Data produzione", "visible": true, "x": 5, "y": 40, "fontSize": 10, "bold": false},
      {"key": "expiry_date", "label": "Scadenza", "visible": true, "x": 5, "y": 48, "fontSize": 10, "bold": false},
      {"key": "ingredients", "label": "Ingredienti", "visible": true, "x": 5, "y": 56, "fontSize": 8, "bold": false},
      {"key": "company_address", "label": "Indirizzo", "visible": true, "x": 5, "y": 64, "fontSize": 7, "bold": false}
    ]
  }'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own label_templates" ON public.label_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_label_templates_updated_at BEFORE UPDATE ON public.label_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
