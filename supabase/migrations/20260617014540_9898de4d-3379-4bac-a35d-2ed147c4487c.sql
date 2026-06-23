DROP POLICY IF EXISTS reports_update_creator_admin_or_section_owner ON public.reports;

CREATE POLICY reports_update_creator_admin_or_section_owner
ON public.reports
FOR UPDATE
USING (
  created_by = auth.uid()
  OR is_admin_or_operator(auth.uid())
  OR is_resp_tecnico_or_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM report_sections rs
    JOIN professionals p ON p.user_id = auth.uid()
    WHERE rs.report_id = reports.id
      AND (
        rs.professional_id = p.id
        OR (rs.specialty_id IS NOT NULL AND rs.specialty_id = p.specialty_id)
      )
  )
);