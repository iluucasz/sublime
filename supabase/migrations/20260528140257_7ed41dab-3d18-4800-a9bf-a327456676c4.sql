
CREATE TABLE public.edit_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  parent_id uuid,
  table_name text NOT NULL,
  action text NOT NULL,
  changed_by uuid,
  changed_by_name text,
  field_changes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_edit_audit_log_entity ON public.edit_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_edit_audit_log_parent ON public.edit_audit_log(entity_type, parent_id, created_at DESC);

GRANT SELECT, INSERT ON public.edit_audit_log TO authenticated;
GRANT ALL ON public.edit_audit_log TO service_role;

ALTER TABLE public.edit_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY eal_select ON public.edit_audit_log FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY eal_insert ON public.edit_audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Generic trigger function. TG_ARGV[0] = entity_type, TG_ARGV[1] = parent column name (optional)
CREATE OR REPLACE FUNCTION public.log_entity_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_entity_type text := TG_ARGV[0];
  v_parent_col text := COALESCE(TG_ARGV[1], '');
  v_parent_id uuid;
  v_entity_id uuid;
  v_changes jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_key text;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_user;

  v_entity_id := COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid);
  IF v_parent_col <> '' THEN
    v_parent_id := COALESCE((to_jsonb(NEW)->>v_parent_col)::uuid, (to_jsonb(OLD)->>v_parent_col)::uuid);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key IN ('updated_at','created_at') THEN CONTINUE; END IF;
      IF v_new->v_key IS DISTINCT FROM v_old->v_key THEN
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.edit_audit_log(entity_type, entity_id, parent_id, table_name, action, changed_by, changed_by_name, field_changes)
  VALUES (v_entity_type, v_entity_id, v_parent_id, TG_TABLE_NAME, TG_OP, v_user, v_name, v_changes);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Templates
CREATE TRIGGER trg_audit_report_templates
AFTER INSERT OR UPDATE OR DELETE ON public.report_templates
FOR EACH ROW EXECUTE FUNCTION public.log_entity_changes('report_template');

CREATE TRIGGER trg_audit_report_template_modules
AFTER INSERT OR UPDATE OR DELETE ON public.report_template_modules
FOR EACH ROW EXECUTE FUNCTION public.log_entity_changes('report_template', 'template_id');

-- Assessments (evolução)
CREATE TRIGGER trg_audit_assessments
AFTER INSERT OR UPDATE OR DELETE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.log_entity_changes('assessment');

CREATE TRIGGER trg_audit_assessment_items
AFTER INSERT OR UPDATE OR DELETE ON public.assessment_items
FOR EACH ROW EXECUTE FUNCTION public.log_entity_changes('assessment', 'assessment_id');

CREATE TRIGGER trg_audit_assessment_applications
AFTER INSERT OR UPDATE OR DELETE ON public.assessment_applications
FOR EACH ROW EXECUTE FUNCTION public.log_entity_changes('assessment', 'assessment_id');

CREATE TRIGGER trg_audit_assessment_results
AFTER INSERT OR UPDATE OR DELETE ON public.assessment_results
FOR EACH ROW EXECUTE FUNCTION public.log_entity_changes('assessment_application', 'application_id');
