ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_user_id_unique UNIQUE (user_id);

DROP POLICY IF EXISTS professionals_update_admin ON public.professionals;
CREATE POLICY professionals_update_admin_or_own
ON public.professionals
FOR UPDATE
TO authenticated
USING (public.is_admin_or_operator(auth.uid()) OR user_id = auth.uid())
WITH CHECK (public.is_admin_or_operator(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS professionals_write_admin ON public.professionals;
CREATE POLICY professionals_insert_admin_or_own
ON public.professionals
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_operator(auth.uid())
  OR (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Admin can upload stamps" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update stamps" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete stamps" ON storage.objects;

CREATE POLICY "Professional can upload own stamps"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'professional-stamps'
  AND (
    public.is_admin_or_operator(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM public.professionals p
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Professional can update own stamps"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'professional-stamps'
  AND (
    public.is_admin_or_operator(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM public.professionals p
      WHERE p.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'professional-stamps'
  AND (
    public.is_admin_or_operator(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM public.professionals p
      WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Professional can delete own stamps"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'professional-stamps'
  AND (
    public.is_admin_or_operator(auth.uid())
    OR (storage.foldername(name))[1] IN (
      SELECT p.id::text
      FROM public.professionals p
      WHERE p.user_id = auth.uid()
    )
  )
);