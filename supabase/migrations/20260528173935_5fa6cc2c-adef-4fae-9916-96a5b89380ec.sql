
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cargo text;
  v_full_name text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
  v_cargo := NEW.raw_user_meta_data->>'cargo';

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, v_full_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF v_cargo IN ('diretoria','responsavel_tecnico','profissional_lideranca','profissional') THEN
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

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
