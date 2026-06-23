
-- Helper: is the user a member of clinic staff (professional, operator, or diretoria)?
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_operator(_user_id)
    OR EXISTS (SELECT 1 FROM public.professionals WHERE user_id = _user_id AND status = 'ativo')
    OR EXISTS (SELECT 1 FROM public.operators WHERE user_id = _user_id AND status = 'ativo');
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_operator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_operator(uuid) TO authenticated, service_role;

-- profiles
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin_or_operator(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select_own_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'diretoria'::app_role));

-- operators (contains email/phone)
DROP POLICY IF EXISTS operators_select ON public.operators;
CREATE POLICY operators_select_admin ON public.operators
  FOR SELECT TO authenticated
  USING (public.is_admin_or_operator(auth.uid()) OR user_id = auth.uid());

-- patient_documents
DROP POLICY IF EXISTS patient_documents_select ON public.patient_documents;
CREATE POLICY patient_documents_select_staff ON public.patient_documents
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- patients
DROP POLICY IF EXISTS patients_select ON public.patients;
CREATE POLICY patients_select_staff ON public.patients
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- professionals (contains CPF)
DROP POLICY IF EXISTS professionals_select ON public.professionals;
CREATE POLICY professionals_select_staff ON public.professionals
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

-- reports update -> only creator or admin/operator
DROP POLICY IF EXISTS reports_update ON public.reports;
CREATE POLICY reports_update_creator_or_admin ON public.reports
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin_or_operator(auth.uid()));

-- report_sections writes -> creator or admin/operator
DROP POLICY IF EXISTS report_sections_insert ON public.report_sections;
DROP POLICY IF EXISTS report_sections_update ON public.report_sections;
DROP POLICY IF EXISTS report_sections_delete ON public.report_sections;

CREATE POLICY report_sections_insert_staff ON public.report_sections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY report_sections_update_owner_or_admin ON public.report_sections
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin_or_operator(auth.uid()));

CREATE POLICY report_sections_delete_owner_or_admin ON public.report_sections
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin_or_operator(auth.uid()));

-- Storage: patient-docs (private bucket) -> staff only
DROP POLICY IF EXISTS patient_docs_select ON storage.objects;
DROP POLICY IF EXISTS patient_docs_insert ON storage.objects;
DROP POLICY IF EXISTS patient_docs_update ON storage.objects;
DROP POLICY IF EXISTS patient_docs_delete ON storage.objects;

CREATE POLICY patient_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'patient-docs' AND public.is_staff(auth.uid()));
CREATE POLICY patient_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-docs' AND public.is_staff(auth.uid()));
CREATE POLICY patient_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'patient-docs' AND public.is_admin_or_operator(auth.uid()));
CREATE POLICY patient_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'patient-docs' AND public.is_admin_or_operator(auth.uid()));

-- Storage: professional-stamps writes -> admin/operator only (kept public read so stamps render in reports)
DROP POLICY IF EXISTS "Authenticated can upload stamps" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update stamps" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete stamps" ON storage.objects;

CREATE POLICY "Admin can upload stamps" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'professional-stamps' AND public.is_admin_or_operator(auth.uid()));
CREATE POLICY "Admin can update stamps" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'professional-stamps' AND public.is_admin_or_operator(auth.uid()));
CREATE POLICY "Admin can delete stamps" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'professional-stamps' AND public.is_admin_or_operator(auth.uid()));
