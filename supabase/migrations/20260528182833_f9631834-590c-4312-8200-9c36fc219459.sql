DROP POLICY IF EXISTS report_sections_update_owner_or_admin ON public.report_sections;

CREATE POLICY report_sections_update_owner_or_admin
ON public.report_sections
FOR UPDATE
TO authenticated
USING (
  (created_by = auth.uid())
  OR is_admin_or_operator(auth.uid())
  OR is_resp_tecnico_or_admin(auth.uid())
  OR (specialty_id IS NULL AND is_staff(auth.uid()))
  OR (specialty_id IS NOT NULL AND is_specialty_professional(auth.uid(), specialty_id))
);