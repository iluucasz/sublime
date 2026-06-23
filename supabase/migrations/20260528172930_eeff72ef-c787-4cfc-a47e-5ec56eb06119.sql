-- Permitir que qualquer profissional ativo (staff) crie recados próprios.
-- Edição/exclusão segue restrita ao próprio autor ou liderança.
DROP POLICY IF EXISTS ann_insert ON public.announcements;

CREATE POLICY ann_insert
ON public.announcements
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_staff(auth.uid()) AND author_id = auth.uid()
);