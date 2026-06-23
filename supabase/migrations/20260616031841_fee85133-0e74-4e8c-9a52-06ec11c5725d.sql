-- Adiciona dois novos status ao fluxo de relatórios
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'encaminhado_diretoria' BEFORE 'aprovado_diretoria';
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'assinado' BEFORE 'liberado_pais';

-- Permite que o profissional que tem seção no relatório também possa atualizar (para encaminhar/assinar)
DROP POLICY IF EXISTS reports_update_creator_or_admin ON public.reports;
CREATE POLICY reports_update_creator_admin_or_section_owner
ON public.reports
FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.is_admin_or_operator(auth.uid())
  OR public.is_resp_tecnico_or_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.report_sections rs
    JOIN public.professionals p ON p.id = rs.professional_id
    WHERE rs.report_id = reports.id AND p.user_id = auth.uid()
  )
);