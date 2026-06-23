CREATE OR REPLACE FUNCTION public.is_specialty_professional(_user_id uuid, _specialty_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professionals
    WHERE user_id = _user_id
      AND specialty_id = _specialty_id
      AND status = 'ativo'
  )
$$;

DROP POLICY IF EXISTS report_sections_update_owner_or_admin ON public.report_sections;

CREATE POLICY report_sections_update_owner_or_admin
ON public.report_sections
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR is_admin_or_operator(auth.uid())
  OR is_resp_tecnico_or_admin(auth.uid())
  OR (specialty_id IS NOT NULL AND is_specialty_professional(auth.uid(), specialty_id))
);