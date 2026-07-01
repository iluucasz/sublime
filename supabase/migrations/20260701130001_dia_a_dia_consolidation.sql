-- =====================================================================
-- MÓDULO DIA A DIA — consolidação no banco principal
-- Origem: projeto Supabase yhpfddvvlmiwhwihjgve (Sublime Dia a Dia)
--
-- Estratégia (igual ao Clinic Sync):
--  * Tabelas prefixadas com dd_ para não colidir (o principal já tem
--    patients / professionals).
--  * Enums namespaced: dd_document_type, dd_notice_category.
--  * NÃO recria profiles / user_roles / app_role / has_role.
--  * Campos por-usuário específicos do módulo (approved, whatsapp) vão para
--    dd_members (o principal usa profiles.id = auth.uid, sem esses campos).
--  * "admin" do módulo mapeia para diretoria/operador via dd_is_admin().
--    Ponto ajustável da Fase 5.
--  * Papéis granulares (customer_success, blog_author, podcast_author, ...)
--    já foram adicionados ao enum na migration 20260701130000.
-- =====================================================================

-- ============ ENUMS (namespaced) ============
CREATE TYPE public.dd_document_type AS ENUM
  ('therapy_plan','semester_report','aba_report','other','medical_request');
CREATE TYPE public.dd_notice_category AS ENUM
  ('billing','reception','clinical','event','customer_success');

-- ============ HELPERS ============
-- "admin" do Dia a Dia = administração do principal. Ajustável na Fase 5.
CREATE OR REPLACE FUNCTION public.dd_is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id,'diretoria') OR public.has_role(_user_id,'operador')
$$;

-- ============ MEMBROS (approved + whatsapp específicos do módulo) ============
CREATE TABLE public.dd_members (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  approved   BOOLEAN NOT NULL DEFAULT true,   -- default true p/ não travar usuários migrados
  whatsapp   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_members TO authenticated;
GRANT ALL ON public.dd_members TO service_role;
ALTER TABLE public.dd_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dd_members_updated BEFORE UPDATE ON public.dd_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "dd_members read self or staff" ON public.dd_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'customer_success'));
CREATE POLICY "dd_members self upsert" ON public.dd_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.dd_is_admin(auth.uid()));
CREATE POLICY "dd_members staff manage" ON public.dd_members FOR UPDATE TO authenticated
  USING (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'customer_success'));
CREATE POLICY "dd_members admin delete" ON public.dd_members FOR DELETE TO authenticated
  USING (public.dd_is_admin(auth.uid()));

-- ============ PACIENTES (crianças) ============
CREATE TABLE public.dd_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  child_name TEXT NOT NULL,
  admission_date DATE,
  birth_date DATE,
  medical_request_date DATE,
  unit TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_patients TO authenticated;
GRANT ALL ON public.dd_patients TO service_role;
ALTER TABLE public.dd_patients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dd_patients_updated BEFORE UPDATE ON public.dd_patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "dd_patients parent view own" ON public.dd_patients FOR SELECT TO authenticated
  USING (auth.uid() = parent_user_id);
CREATE POLICY "dd_patients staff view" ON public.dd_patients FOR SELECT TO authenticated
  USING (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'customer_success'));
CREATE POLICY "dd_patients admin manage" ON public.dd_patients FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid())) WITH CHECK (public.dd_is_admin(auth.uid()));

-- ============ GRADE TERAPÊUTICA ============
CREATE TABLE public.dd_therapy_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.dd_patients(id) ON DELETE CASCADE,
  weekday TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  professional TEXT NOT NULL,
  room TEXT,
  therapy_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_therapy_schedule TO authenticated;
GRANT ALL ON public.dd_therapy_schedule TO service_role;
ALTER TABLE public.dd_therapy_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_schedule parent view" ON public.dd_therapy_schedule FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dd_patients p WHERE p.id = patient_id AND p.parent_user_id = auth.uid()));
CREATE POLICY "dd_schedule staff view" ON public.dd_therapy_schedule FOR SELECT TO authenticated
  USING (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'customer_success'));
CREATE POLICY "dd_schedule admin manage" ON public.dd_therapy_schedule FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid())) WITH CHECK (public.dd_is_admin(auth.uid()));

-- ============ DOCUMENTOS ============
CREATE TABLE public.dd_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.dd_patients(id) ON DELETE CASCADE,
  doc_type public.dd_document_type NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_documents TO authenticated;
GRANT ALL ON public.dd_documents TO service_role;
ALTER TABLE public.dd_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_documents parent view" ON public.dd_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dd_patients p WHERE p.id = patient_id AND p.parent_user_id = auth.uid()));
CREATE POLICY "dd_documents staff view" ON public.dd_documents FOR SELECT TO authenticated
  USING (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'customer_success'));
CREATE POLICY "dd_documents admin manage" ON public.dd_documents FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid())) WITH CHECK (public.dd_is_admin(auth.uid()));

-- ============ AVISOS ============
CREATE TABLE public.dd_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.dd_patients(id) ON DELETE CASCADE,
  category public.dd_notice_category NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  send_whatsapp BOOLEAN NOT NULL DEFAULT false,
  whatsapp_status TEXT,
  read_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_notices TO authenticated;
GRANT ALL ON public.dd_notices TO service_role;
ALTER TABLE public.dd_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_notices parent view" ON public.dd_notices FOR SELECT TO authenticated
  USING (patient_id IS NULL OR EXISTS (SELECT 1 FROM public.dd_patients p WHERE p.id = patient_id AND p.parent_user_id = auth.uid()));
CREATE POLICY "dd_notices parent read state" ON public.dd_notices FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dd_patients p WHERE p.id = patient_id AND p.parent_user_id = auth.uid()));
-- Staff que pode VER avisos: admin, recepção, sucesso ao cliente, avisos.
CREATE POLICY "dd_notices staff view" ON public.dd_notices FOR SELECT TO authenticated
  USING (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'reception')
         OR public.has_role(auth.uid(),'customer_success') OR public.has_role(auth.uid(),'avisos'));
-- Staff que pode ENVIAR/gerir avisos: admin, sucesso ao cliente, avisos (recepção só vê).
CREATE POLICY "dd_notices sender manage" ON public.dd_notices FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'customer_success') OR public.has_role(auth.uid(),'avisos'))
  WITH CHECK (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'customer_success') OR public.has_role(auth.uid(),'avisos'));

-- ============ PROFISSIONAIS (cadastro simples do módulo) ============
CREATE TABLE public.dd_professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  unit TEXT,
  work_days TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_professionals TO authenticated;
GRANT ALL ON public.dd_professionals TO service_role;
ALTER TABLE public.dd_professionals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dd_professionals_updated BEFORE UPDATE ON public.dd_professionals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "dd_professionals staff view" ON public.dd_professionals FOR SELECT TO authenticated
  USING (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'customer_success'));
CREATE POLICY "dd_professionals admin manage" ON public.dd_professionals FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid())) WITH CHECK (public.dd_is_admin(auth.uid()));

-- ============ GRUPOS DE PACIENTES ============
CREATE TABLE public.dd_patient_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_patient_groups TO authenticated;
GRANT ALL ON public.dd_patient_groups TO service_role;
ALTER TABLE public.dd_patient_groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dd_patient_groups_updated BEFORE UPDATE ON public.dd_patient_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "dd_patient_groups admin manage" ON public.dd_patient_groups FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid())) WITH CHECK (public.dd_is_admin(auth.uid()));

CREATE TABLE public.dd_patient_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.dd_patient_groups(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.dd_patients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, patient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_patient_group_members TO authenticated;
GRANT ALL ON public.dd_patient_group_members TO service_role;
ALTER TABLE public.dd_patient_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dd_patient_group_members admin manage" ON public.dd_patient_group_members FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid())) WITH CHECK (public.dd_is_admin(auth.uid()));

-- ============ BLOG ============
CREATE TABLE public.dd_blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_blog_posts TO authenticated;
GRANT ALL ON public.dd_blog_posts TO service_role;
ALTER TABLE public.dd_blog_posts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dd_blog_posts_updated BEFORE UPDATE ON public.dd_blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "dd_blog authenticated view" ON public.dd_blog_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "dd_blog admin manage" ON public.dd_blog_posts FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid())) WITH CHECK (public.dd_is_admin(auth.uid()));
CREATE POLICY "dd_blog authors insert" ON public.dd_blog_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'blog_author') AND author_id = auth.uid());
CREATE POLICY "dd_blog authors update own" ON public.dd_blog_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'blog_author') AND author_id = auth.uid());
CREATE POLICY "dd_blog authors delete own" ON public.dd_blog_posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'blog_author') AND author_id = auth.uid());

-- ============ PODCAST ============
CREATE TABLE public.dd_podcast_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  audio_path TEXT NOT NULL,
  author_id UUID,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_podcast_episodes TO authenticated;
GRANT ALL ON public.dd_podcast_episodes TO service_role;
ALTER TABLE public.dd_podcast_episodes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_dd_podcast_episodes_updated BEFORE UPDATE ON public.dd_podcast_episodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "dd_podcast authenticated view" ON public.dd_podcast_episodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "dd_podcast admin manage" ON public.dd_podcast_episodes FOR ALL TO authenticated
  USING (public.dd_is_admin(auth.uid())) WITH CHECK (public.dd_is_admin(auth.uid()));
CREATE POLICY "dd_podcast authors insert" ON public.dd_podcast_episodes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'podcast_author') AND author_id = auth.uid());
CREATE POLICY "dd_podcast authors update own" ON public.dd_podcast_episodes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'podcast_author') AND author_id = auth.uid());
CREATE POLICY "dd_podcast authors delete own" ON public.dd_podcast_episodes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'podcast_author') AND author_id = auth.uid());

-- ============ REAÇÕES A CONTEÚDO ============
CREATE TABLE public.dd_content_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('blog','podcast')),
  content_id UUID NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like','love')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id, reaction)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_content_reactions TO authenticated;
GRANT ALL ON public.dd_content_reactions TO service_role;
ALTER TABLE public.dd_content_reactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dd_content_reactions_content ON public.dd_content_reactions (content_type, content_id);
CREATE POLICY "dd_reactions authenticated view" ON public.dd_content_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dd_reactions insert own" ON public.dd_content_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dd_reactions delete own" ON public.dd_content_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ STORAGE ============
-- documents (privado, até 100MB) — nomes não colidem com patient-docs/session-files
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('documents','documents', false, 104857600) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('podcasts','podcasts', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "dd docs admin upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.dd_is_admin(auth.uid()));
CREATE POLICY "dd docs admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND public.dd_is_admin(auth.uid()));
CREATE POLICY "dd docs admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.dd_is_admin(auth.uid()));
CREATE POLICY "dd docs staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (public.dd_is_admin(auth.uid())
         OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'customer_success')));
CREATE POLICY "dd docs parent read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.dd_documents d JOIN public.dd_patients p ON p.id = d.patient_id
    WHERE d.storage_path = name AND p.parent_user_id = auth.uid()
  ));

CREATE POLICY "dd podcasts public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'podcasts');
CREATE POLICY "dd podcasts authors upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'podcasts' AND (public.dd_is_admin(auth.uid()) OR public.has_role(auth.uid(),'podcast_author')));
CREATE POLICY "dd podcasts authors delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'podcasts' AND (public.dd_is_admin(auth.uid())
         OR (public.has_role(auth.uid(),'podcast_author') AND owner = auth.uid())));

-- ============ REVOKES ============
REVOKE EXECUTE ON FUNCTION public.dd_is_admin(UUID) FROM PUBLIC, anon;
