
-- Helper: is responsavel tecnico OR diretoria
CREATE OR REPLACE FUNCTION public.is_resp_tecnico_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('diretoria','responsavel_tecnico')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_resp_tecnico_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_resp_tecnico_or_admin(uuid) TO authenticated, service_role;

-- =========================================
-- REPORT TEMPLATES
-- =========================================
CREATE TABLE public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'ativo',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY rt_select ON public.report_templates FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY rt_insert ON public.report_templates FOR INSERT TO authenticated WITH CHECK (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY rt_update ON public.report_templates FOR UPDATE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY rt_delete ON public.report_templates FOR DELETE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));

CREATE TRIGGER trg_rt_updated BEFORE UPDATE ON public.report_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.report_template_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.report_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  specialty_id uuid REFERENCES public.specialties(id) ON DELETE SET NULL,
  description text,
  order_index int NOT NULL DEFAULT 0,
  requires_assessment boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_template_modules TO authenticated;
GRANT ALL ON public.report_template_modules TO service_role;
ALTER TABLE public.report_template_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY rtm_select ON public.report_template_modules FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY rtm_insert ON public.report_template_modules FOR INSERT TO authenticated WITH CHECK (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY rtm_update ON public.report_template_modules FOR UPDATE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY rtm_delete ON public.report_template_modules FOR DELETE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));

-- Link reports -> templates
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.report_templates(id) ON DELETE SET NULL;

-- =========================================
-- ASSESSMENTS (catálogo + aplicações + resultados)
-- =========================================
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  specialty_id uuid REFERENCES public.specialties(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY a_select ON public.assessments FOR SELECT TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY a_insert ON public.assessments FOR INSERT TO authenticated WITH CHECK (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY a_update ON public.assessments FOR UPDATE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY a_delete ON public.assessments FOR DELETE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));

CREATE TRIGGER trg_a_updated BEFORE UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  max_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_items TO authenticated;
GRANT ALL ON public.assessment_items TO service_role;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_select ON public.assessment_items FOR SELECT TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY ai_insert ON public.assessment_items FOR INSERT TO authenticated WITH CHECK (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY ai_update ON public.assessment_items FOR UPDATE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY ai_delete ON public.assessment_items FOR DELETE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));

CREATE TABLE public.assessment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  applied_at date NOT NULL DEFAULT CURRENT_DATE,
  applied_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_applications TO authenticated;
GRANT ALL ON public.assessment_applications TO service_role;
ALTER TABLE public.assessment_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY aa_select ON public.assessment_applications FOR SELECT TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY aa_insert ON public.assessment_applications FOR INSERT TO authenticated WITH CHECK (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY aa_update ON public.assessment_applications FOR UPDATE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY aa_delete ON public.assessment_applications FOR DELETE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));

CREATE TABLE public.assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.assessment_applications(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.assessment_items(id) ON DELETE CASCADE,
  score numeric,
  observation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_results TO authenticated;
GRANT ALL ON public.assessment_results TO service_role;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY ar_select ON public.assessment_results FOR SELECT TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY ar_insert ON public.assessment_results FOR INSERT TO authenticated WITH CHECK (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY ar_update ON public.assessment_results FOR UPDATE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY ar_delete ON public.assessment_results FOR DELETE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));

CREATE INDEX idx_aa_patient ON public.assessment_applications(patient_id, applied_at);
CREATE INDEX idx_ar_app ON public.assessment_results(application_id);
CREATE INDEX idx_rtm_template ON public.report_template_modules(template_id, order_index);
