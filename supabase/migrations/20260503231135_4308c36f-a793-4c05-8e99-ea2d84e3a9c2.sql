
CREATE OR REPLACE FUNCTION public.operator_company(p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin uuid;
  v_company record;
BEGIN
  SELECT user_id INTO v_admin FROM public.operators WHERE id = p_operator_id AND is_active = true;
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT business_name, vat, address, logo_url, email, phone
  INTO v_company
  FROM public.company_settings
  WHERE user_id = v_admin
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'company', null);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'company', jsonb_build_object(
      'business_name', v_company.business_name,
      'logo_url', v_company.logo_url,
      'address', v_company.address,
      'vat', v_company.vat
    )
  );
END;
$$;
