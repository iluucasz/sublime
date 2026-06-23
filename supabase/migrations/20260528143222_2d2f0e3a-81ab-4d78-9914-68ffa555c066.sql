
-- Announcements (recados direcionados)
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  author_role TEXT,
  kind TEXT NOT NULL DEFAULT 'aviso',
  title TEXT NOT NULL,
  body TEXT,
  target_type TEXT NOT NULL DEFAULT 'all',
  target_unit_id UUID,
  target_professional_id UUID,
  target_role TEXT,
  report_id UUID,
  patient_id UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY ann_select ON public.announcements FOR SELECT TO authenticated
USING (
  is_resp_tecnico_or_admin(auth.uid())
  OR author_id = auth.uid()
  OR target_type = 'all'
  OR (target_type = 'professional' AND EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = target_professional_id AND p.user_id = auth.uid()))
  OR (target_type = 'unit' AND EXISTS (
        SELECT 1 FROM public.professionals p WHERE p.user_id = auth.uid() AND p.unit_id = target_unit_id
        UNION SELECT 1 FROM public.operators o WHERE o.user_id = auth.uid() AND o.unit_id = target_unit_id))
  OR (target_type = 'role' AND has_role(auth.uid(), target_role::app_role))
);
CREATE POLICY ann_insert ON public.announcements FOR INSERT TO authenticated
WITH CHECK (is_resp_tecnico_or_admin(auth.uid()) AND author_id = auth.uid());
CREATE POLICY ann_update ON public.announcements FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR is_resp_tecnico_or_admin(auth.uid())
  OR (target_type = 'professional' AND EXISTS (SELECT 1 FROM public.professionals p WHERE p.id = target_professional_id AND p.user_id = auth.uid())));
CREATE POLICY ann_delete ON public.announcements FOR DELETE TO authenticated
USING (author_id = auth.uid() OR has_role(auth.uid(), 'diretoria'::app_role));

-- Reads tracker
CREATE TABLE public.announcement_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY anr_select ON public.announcement_reads FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY anr_insert ON public.announcement_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY anr_delete ON public.announcement_reads FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Goals (metas e indicadores)
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'global',
  unit_id UUID,
  specialty_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL DEFAULT 'custom',
  target_value NUMERIC NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'mes',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_select ON public.goals FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY goals_insert ON public.goals FOR INSERT TO authenticated WITH CHECK (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY goals_update ON public.goals FOR UPDATE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY goals_delete ON public.goals FOR DELETE TO authenticated USING (has_role(auth.uid(),'diretoria'::app_role));
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Case studies (estudo de caso)
CREATE TABLE public.case_studies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  triggered_by_field TEXT,
  field_label TEXT,
  last_value NUMERIC,
  min_target NUMERIC,
  status TEXT NOT NULL DEFAULT 'aberto',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_studies TO authenticated;
GRANT ALL ON public.case_studies TO service_role;
ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_select ON public.case_studies FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY cs_insert ON public.case_studies FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY cs_update ON public.case_studies FOR UPDATE TO authenticated USING (is_resp_tecnico_or_admin(auth.uid()));
CREATE POLICY cs_delete ON public.case_studies FOR DELETE TO authenticated USING (has_role(auth.uid(),'diretoria'::app_role));

CREATE INDEX idx_announcements_target_prof ON public.announcements(target_professional_id);
CREATE INDEX idx_announcements_target_unit ON public.announcements(target_unit_id);
CREATE INDEX idx_announcements_resolved ON public.announcements(resolved_at);
CREATE INDEX idx_case_studies_patient ON public.case_studies(patient_id);
CREATE INDEX idx_case_studies_status ON public.case_studies(status);
