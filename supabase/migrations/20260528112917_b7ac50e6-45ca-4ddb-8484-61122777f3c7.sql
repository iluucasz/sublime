
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('diretoria', 'rt', 'profissional', 'operador');
CREATE TYPE public.patient_status AS ENUM ('ativo', 'desligado');
CREATE TYPE public.professional_status AS ENUM ('ativo', 'desligado');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to check role without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_operator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('diretoria','operador')
  )
$$;

-- ============ UNITS ============
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- ============ SPECIALTIES ============
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialties TO authenticated;
GRANT ALL ON public.specialties TO service_role;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;

INSERT INTO public.specialties (name, color) VALUES
  ('Fonoaudiologia', '#6BB6E3'),
  ('Terapia Ocupacional', '#F5C842'),
  ('Psicologia', '#E55D87'),
  ('Psicopedagogia', '#F26B3A'),
  ('Musicoterapia', '#9B72CF'),
  ('Fisioterapia', '#2C2E6B');

-- ============ PROFESSIONALS ============
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  specialty_id UUID REFERENCES public.specialties(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  council_number TEXT,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status professional_status NOT NULL DEFAULT 'ativo',
  termination_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professionals TO authenticated;
GRANT ALL ON public.professionals TO service_role;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- ============ OPERATORS ============
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  role_title TEXT,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status professional_status NOT NULL DEFAULT 'ativo',
  termination_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- ============ PATIENTS ============
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  sublime_entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  main_diagnosis TEXT,
  guardian_name TEXT,
  guardian_phone TEXT,
  notes TEXT,
  status patient_status NOT NULL DEFAULT 'ativo',
  termination_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- ============ PATIENT DOCUMENTS ============
CREATE TABLE public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_path TEXT,
  issued_date DATE,
  expires_at DATE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_documents TO authenticated;
GRANT ALL ON public.patient_documents TO service_role;
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- ============ THERAPY GRID ============
CREATE TABLE public.therapy_grid (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  weekly_frequency INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapy_grid TO authenticated;
GRANT ALL ON public.therapy_grid TO service_role;
ALTER TABLE public.therapy_grid ENABLE ROW LEVEL SECURITY;

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-docs', 'patient-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ============ TRIGGER: auto profile on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_professionals_updated BEFORE UPDATE ON public.professionals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_operators_updated BEFORE UPDATE ON public.operators FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RLS POLICIES ============

-- profiles: each user sees and updates own; everyone authenticated can view names (for lookups)
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles: authenticated can read; only diretoria can write
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_insert_admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'diretoria'));
CREATE POLICY "user_roles_update_admin" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'diretoria'));
CREATE POLICY "user_roles_delete_admin" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'diretoria'));

-- Generic policies builder
CREATE POLICY "units_select" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_write_admin" ON public.units FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "units_update_admin" ON public.units FOR UPDATE TO authenticated USING (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "units_delete_admin" ON public.units FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'diretoria'));

CREATE POLICY "specialties_select" ON public.specialties FOR SELECT TO authenticated USING (true);
CREATE POLICY "specialties_write_admin" ON public.specialties FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "specialties_update_admin" ON public.specialties FOR UPDATE TO authenticated USING (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "specialties_delete_admin" ON public.specialties FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'diretoria'));

CREATE POLICY "professionals_select" ON public.professionals FOR SELECT TO authenticated USING (true);
CREATE POLICY "professionals_write_admin" ON public.professionals FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "professionals_update_admin" ON public.professionals FOR UPDATE TO authenticated USING (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "professionals_delete_admin" ON public.professionals FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'diretoria'));

CREATE POLICY "operators_select" ON public.operators FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators_write_admin" ON public.operators FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "operators_update_admin" ON public.operators FOR UPDATE TO authenticated USING (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "operators_delete_admin" ON public.operators FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'diretoria'));

CREATE POLICY "patients_select" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "patients_write_admin" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "patients_update_admin" ON public.patients FOR UPDATE TO authenticated USING (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "patients_delete_admin" ON public.patients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'diretoria'));

CREATE POLICY "patient_documents_select" ON public.patient_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "patient_documents_insert" ON public.patient_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "patient_documents_update_admin" ON public.patient_documents FOR UPDATE TO authenticated USING (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "patient_documents_delete_admin" ON public.patient_documents FOR DELETE TO authenticated USING (public.is_admin_or_operator(auth.uid()));

CREATE POLICY "therapy_grid_select" ON public.therapy_grid FOR SELECT TO authenticated USING (true);
CREATE POLICY "therapy_grid_write" ON public.therapy_grid FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "therapy_grid_update" ON public.therapy_grid FOR UPDATE TO authenticated USING (public.is_admin_or_operator(auth.uid()));
CREATE POLICY "therapy_grid_delete" ON public.therapy_grid FOR DELETE TO authenticated USING (public.is_admin_or_operator(auth.uid()));

-- Storage policies for patient-docs bucket
CREATE POLICY "patient_docs_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'patient-docs');
CREATE POLICY "patient_docs_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'patient-docs');
CREATE POLICY "patient_docs_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'patient-docs');
CREATE POLICY "patient_docs_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'patient-docs' AND public.is_admin_or_operator(auth.uid()));
