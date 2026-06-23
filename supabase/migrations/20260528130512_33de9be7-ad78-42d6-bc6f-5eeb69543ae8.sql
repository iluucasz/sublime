
-- 1) Add new role value to app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'profissional_lideranca';

-- 2) Add cargo column to operators
ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS cargo text
  CHECK (cargo IN ('diretoria','responsavel_tecnico','profissional_lideranca','profissional'));

-- 3) Update helper to include profissional_lideranca (use text cast to avoid enum-in-tx restriction)
CREATE OR REPLACE FUNCTION public.is_resp_tecnico_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('diretoria','responsavel_tecnico','profissional_lideranca')
  )
$$;

-- 4) Trigger to sync operators.cargo -> user_roles
CREATE OR REPLACE FUNCTION public.sync_operator_cargo_to_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NOT NULL AND OLD.cargo IS NOT NULL THEN
      DELETE FROM public.user_roles
      WHERE user_id = OLD.user_id AND role::text = OLD.cargo;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.user_id IS NULL OR NEW.cargo IS NULL THEN
    RETURN NEW;
  END IF;

  -- Remove previous cargo role if changed
  IF TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL AND OLD.cargo IS NOT NULL
     AND (OLD.cargo IS DISTINCT FROM NEW.cargo OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
    DELETE FROM public.user_roles
    WHERE user_id = OLD.user_id AND role::text = OLD.cargo;
  END IF;

  v_role := NEW.cargo::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_operators_cargo_sync ON public.operators;
CREATE TRIGGER trg_operators_cargo_sync
AFTER INSERT OR UPDATE OR DELETE ON public.operators
FOR EACH ROW EXECUTE FUNCTION public.sync_operator_cargo_to_role();

-- 5) Section-level signers
CREATE TABLE IF NOT EXISTS public.report_section_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL,
  report_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  signed_at timestamptz,
  signed_by uuid,
  signature_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, professional_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_section_signers TO authenticated;
GRANT ALL ON public.report_section_signers TO service_role;

ALTER TABLE public.report_section_signers ENABLE ROW LEVEL SECURITY;

CREATE POLICY rss_select ON public.report_section_signers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY rss_insert ON public.report_section_signers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_resp_tecnico_or_admin(auth.uid()));

CREATE POLICY rss_update ON public.report_section_signers
  FOR UPDATE TO authenticated
  USING (
    public.is_resp_tecnico_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = report_section_signers.professional_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY rss_delete ON public.report_section_signers
  FOR DELETE TO authenticated
  USING (public.is_resp_tecnico_or_admin(auth.uid()));

-- 6) Report-level (final) signers
CREATE TABLE IF NOT EXISTS public.report_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  role_label text,
  order_index integer NOT NULL DEFAULT 0,
  signed_at timestamptz,
  signed_by uuid,
  signature_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, professional_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_signers TO authenticated;
GRANT ALL ON public.report_signers TO service_role;

ALTER TABLE public.report_signers ENABLE ROW LEVEL SECURITY;

CREATE POLICY rs_select ON public.report_signers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY rs_insert ON public.report_signers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_resp_tecnico_or_admin(auth.uid()));

CREATE POLICY rs_update ON public.report_signers
  FOR UPDATE TO authenticated
  USING (
    public.is_resp_tecnico_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = report_signers.professional_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY rs_delete ON public.report_signers
  FOR DELETE TO authenticated
  USING (public.is_resp_tecnico_or_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rss_report ON public.report_section_signers(report_id);
CREATE INDEX IF NOT EXISTS idx_rss_prof ON public.report_section_signers(professional_id);
CREATE INDEX IF NOT EXISTS idx_rs_report ON public.report_signers(report_id);
CREATE INDEX IF NOT EXISTS idx_rs_prof ON public.report_signers(professional_id);
