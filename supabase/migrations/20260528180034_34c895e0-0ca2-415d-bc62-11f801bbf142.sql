-- 1) Agrupamento e modo de pontuação
ALTER TABLE public.assessment_items
  ADD COLUMN IF NOT EXISTS group_label text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS instructions text;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS score_mode text NOT NULL DEFAULT 'numeric',
  ADD COLUMN IF NOT EXISTS sector text;

-- 2) Permitir que qualquer profissional (staff) veja o catálogo para responder
DROP POLICY IF EXISTS a_select ON public.assessments;
CREATE POLICY a_select ON public.assessments
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS ai_select ON public.assessment_items;
CREATE POLICY ai_select ON public.assessment_items
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

-- 3) Aplicações: profissionais podem responder (criar/ver/editar suas aplicações)
DROP POLICY IF EXISTS aa_select ON public.assessment_applications;
CREATE POLICY aa_select ON public.assessment_applications
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS aa_insert ON public.assessment_applications;
CREATE POLICY aa_insert ON public.assessment_applications
  FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS aa_update ON public.assessment_applications;
CREATE POLICY aa_update ON public.assessment_applications
  FOR UPDATE TO authenticated
  USING (applied_by = auth.uid() OR is_resp_tecnico_or_admin(auth.uid()));

DROP POLICY IF EXISTS aa_delete ON public.assessment_applications;
CREATE POLICY aa_delete ON public.assessment_applications
  FOR DELETE TO authenticated
  USING (applied_by = auth.uid() OR is_resp_tecnico_or_admin(auth.uid()));

-- 4) Resultados: profissionais podem registrar e ver
DROP POLICY IF EXISTS ar_select ON public.assessment_results;
CREATE POLICY ar_select ON public.assessment_results
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS ar_insert ON public.assessment_results;
CREATE POLICY ar_insert ON public.assessment_results
  FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS ar_update ON public.assessment_results;
CREATE POLICY ar_update ON public.assessment_results
  FOR UPDATE TO authenticated
  USING (
    is_resp_tecnico_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.assessment_applications app
      WHERE app.id = assessment_results.application_id
        AND app.applied_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS ar_delete ON public.assessment_results;
CREATE POLICY ar_delete ON public.assessment_results
  FOR DELETE TO authenticated
  USING (
    is_resp_tecnico_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.assessment_applications app
      WHERE app.id = assessment_results.application_id
        AND app.applied_by = auth.uid()
    )
  );