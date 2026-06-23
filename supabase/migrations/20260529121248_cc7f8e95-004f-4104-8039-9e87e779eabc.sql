
-- 1. Add 'pendente' to professional_status enum
ALTER TYPE public.professional_status ADD VALUE IF NOT EXISTS 'pendente';

-- 2. Update handle_new_user to also create a pending professional row when cargo = profissional
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cargo text;
  v_full_name text;
  v_specialty_id uuid;
  v_unit_id uuid;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  v_cargo := NEW.raw_user_meta_data->>'cargo';
  v_specialty_id := NULLIF(NEW.raw_user_meta_data->>'specialty_id','')::uuid;
  v_unit_id := NULLIF(NEW.raw_user_meta_data->>'unit_id','')::uuid;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, v_full_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF v_cargo = 'profissional' THEN
    -- Profissional: aguarda aprovação da diretoria/RT/liderança
    INSERT INTO public.professionals (user_id, full_name, email, specialty_id, unit_id, admission_date, status)
    VALUES (NEW.id, v_full_name, NEW.email, v_specialty_id, v_unit_id, CURRENT_DATE, 'pendente')
    ON CONFLICT DO NOTHING;

    -- Atribui o papel para que ele possa acessar /meu-perfil; is_staff só libera quando status='ativo'
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'profissional'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

  ELSIF v_cargo IN ('diretoria','responsavel_tecnico','profissional_lideranca') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_cargo::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.operators (user_id, full_name, email, cargo, admission_date, status)
    VALUES (NEW.id, v_full_name, NEW.email, v_cargo, CURRENT_DATE, 'ativo')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
