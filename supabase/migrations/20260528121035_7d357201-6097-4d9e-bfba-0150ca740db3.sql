
-- Status enum for reports
DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('rascunho','em_revisao','aprovado_diretoria','liberado_pais');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Reports: one per patient per period
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  title text NOT NULL,
  period_start date,
  period_end date,
  status public.report_status NOT NULL DEFAULT 'rascunho',
  general_notes text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_select ON public.reports FOR SELECT TO authenticated USING (true);
CREATE POLICY reports_insert ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY reports_update ON public.reports FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY reports_delete_admin ON public.reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'diretoria'));

CREATE TRIGGER trg_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reports_patient ON public.reports(patient_id);

-- Report sections: one per professional/specialty inside a report
CREATE TABLE public.report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  specialty_id uuid,
  professional_id uuid,
  title text NOT NULL,
  content text,
  order_index integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_sections TO authenticated;
GRANT ALL ON public.report_sections TO service_role;

ALTER TABLE public.report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_sections_select ON public.report_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY report_sections_insert ON public.report_sections FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY report_sections_update ON public.report_sections FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY report_sections_delete ON public.report_sections FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_report_sections_updated_at
BEFORE UPDATE ON public.report_sections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_report_sections_report ON public.report_sections(report_id);

-- Audit log
CREATE TABLE public.report_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  section_id uuid,
  table_name text NOT NULL,
  action text NOT NULL,
  changed_by uuid,
  changed_by_name text,
  field_changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.report_audit_log TO authenticated;
GRANT ALL ON public.report_audit_log TO service_role;

ALTER TABLE public.report_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_select ON public.report_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY audit_insert ON public.report_audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_audit_report ON public.report_audit_log(report_id);

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.log_report_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_report_id uuid;
  v_section_id uuid;
  v_changes jsonb := '{}'::jsonb;
  v_action text := TG_OP;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user;

  IF TG_TABLE_NAME = 'reports' THEN
    v_report_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_report_id := COALESCE(NEW.report_id, OLD.report_id);
    v_section_id := COALESCE(NEW.id, OLD.id);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'reports' THEN
      IF NEW.title IS DISTINCT FROM OLD.title THEN v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title)); END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status)); END IF;
      IF NEW.general_notes IS DISTINCT FROM OLD.general_notes THEN v_changes := v_changes || jsonb_build_object('general_notes', 'modificado'); END IF;
      IF NEW.period_start IS DISTINCT FROM OLD.period_start THEN v_changes := v_changes || jsonb_build_object('period_start', jsonb_build_object('old', OLD.period_start, 'new', NEW.period_start)); END IF;
      IF NEW.period_end IS DISTINCT FROM OLD.period_end THEN v_changes := v_changes || jsonb_build_object('period_end', jsonb_build_object('old', OLD.period_end, 'new', NEW.period_end)); END IF;
    ELSE
      IF NEW.title IS DISTINCT FROM OLD.title THEN v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title)); END IF;
      IF NEW.content IS DISTINCT FROM OLD.content THEN v_changes := v_changes || jsonb_build_object('content', 'modificado'); END IF;
    END IF;
    IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.report_audit_log(report_id, section_id, table_name, action, changed_by, changed_by_name, field_changes)
  VALUES (v_report_id, v_section_id, TG_TABLE_NAME, v_action, v_user, v_name, v_changes);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_reports
AFTER INSERT OR UPDATE OR DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.log_report_changes();

CREATE TRIGGER trg_audit_report_sections
AFTER INSERT OR UPDATE OR DELETE ON public.report_sections
FOR EACH ROW EXECUTE FUNCTION public.log_report_changes();
