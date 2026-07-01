-- =====================================================================
-- MÓDULO CLINIC SYNC  — consolidação no banco principal
-- Origem: projeto Supabase sgsqmjapwtasazjbwlei (Sublime Clinic Sync)
--
-- Estratégia:
--  * Tabelas prefixadas com cs_ para não colidir com o schema do principal.
--  * NÃO recria profiles / user_roles / app_role / has_role — reaproveita os
--    do principal.
--  * A camada de "is_active" + "permissions" (que no app original vivia em
--    profiles) vira a tabela própria cs_members, gerida pela tela Equipe.
--  * "admin" do Clinic Sync mapeia para a liderança do principal
--    (diretoria / responsavel_tecnico / profissional_lideranca). Esse mapa é
--    o ponto ajustável da Fase 5 (permissões).
-- =====================================================================

-- ============ TABELA DE MEMBROS (is_active + permissions) ============
CREATE TABLE public.cs_members (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_label  TEXT NOT NULL DEFAULT 'Acompanhante Terapêutica (AT)',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_admin    BOOLEAN NOT NULL DEFAULT false,  -- admin do módulo concedido pela tela Equipe (escopo-módulo)
  permissions JSONB NOT NULL DEFAULT '{
    "edit_patients": false,
    "delete_patients": false,
    "edit_sessions": true,
    "delete_sessions": false,
    "view_reports": true,
    "use_assistant": true,
    "manage_team": false
  }'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_members TO authenticated;
GRANT ALL ON public.cs_members TO service_role;
ALTER TABLE public.cs_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cs_members_updated BEFORE UPDATE ON public.cs_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ HELPERS (prefixo cs_) ============

-- "admin" do módulo = liderança do principal OU flag explícito em cs_members
-- (concedido pela tela Equipe). Ajustável na Fase 5.
CREATE OR REPLACE FUNCTION public.cs_is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id,'diretoria')
      OR public.has_role(_user_id,'responsavel_tecnico')
      OR public.has_role(_user_id,'profissional_lideranca')
      OR COALESCE((SELECT is_admin FROM public.cs_members WHERE user_id = _user_id), false)
$$;

-- Ativo por padrão quando não há linha em cs_members (evita travar quem ainda
-- não foi cadastrado na Equipe). A tela Equipe/ a migração de dados definem
-- valores explícitos.
CREATE OR REPLACE FUNCTION public.cs_is_active(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT is_active FROM public.cs_members WHERE user_id = _user_id), true) $$;

-- Admin sempre true; senão lê da permissão explícita; senão cai no default do módulo.
CREATE OR REPLACE FUNCTION public.cs_has_permission(_user_id UUID, _key TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.cs_is_admin(_user_id)
    OR COALESCE(
         (SELECT (permissions ->> _key)::boolean FROM public.cs_members WHERE user_id = _user_id),
         (('{
            "edit_patients": false, "delete_patients": false,
            "edit_sessions": true, "delete_sessions": false,
            "view_reports": true, "use_assistant": true, "manage_team": false
          }'::jsonb) ->> _key)::boolean,
         false
       )
$$;

-- cs_can_access_child é criada mais abaixo, após cs_child_assignments existir
-- (funções LANGUAGE SQL validam as tabelas referenciadas na criação).

-- ============ CRIANÇAS ============
CREATE TABLE public.cs_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age TEXT,
  level TEXT,
  emoji TEXT DEFAULT '👦',
  guardians TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_children TO authenticated;
GRANT ALL ON public.cs_children TO service_role;
ALTER TABLE public.cs_children ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cs_children_updated BEFORE UPDATE ON public.cs_children
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ATRIBUIÇÕES CRIANÇA x PROFISSIONAL ============
CREATE TABLE public.cs_child_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.cs_children(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_child_assignments TO authenticated;
GRANT ALL ON public.cs_child_assignments TO service_role;
ALTER TABLE public.cs_child_assignments ENABLE ROW LEVEL SECURITY;

-- Agora que cs_child_assignments existe, cria o helper de acesso à criança.
CREATE OR REPLACE FUNCTION public.cs_can_access_child(_user_id UUID, _child_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.cs_is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.cs_child_assignments WHERE child_id = _child_id AND user_id = _user_id)
$$;

-- ============ SESSÕES ============
CREATE TABLE public.cs_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.cs_children(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES auth.users(id),
  professional_name TEXT NOT NULL,
  professional_role TEXT,
  session_date DATE NOT NULL DEFAULT current_date,
  mood TEXT,
  mood_color TEXT,
  skills TEXT[] DEFAULT '{}',
  ratings JSONB DEFAULT '{}'::jsonb,
  activities TEXT,
  observations TEXT,
  message_to_parents TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_sessions TO authenticated;
GRANT ALL ON public.cs_sessions TO service_role;
ALTER TABLE public.cs_sessions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_cs_sessions_updated BEFORE UPDATE ON public.cs_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ANEXOS DE SESSÃO ============
CREATE TABLE public.cs_session_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.cs_sessions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  is_image BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_session_attachments TO authenticated;
GRANT ALL ON public.cs_session_attachments TO service_role;
ALTER TABLE public.cs_session_attachments ENABLE ROW LEVEL SECURITY;

-- ============ RLS ============

-- cs_members: cada um lê o próprio; admin lê/gerencia todos.
CREATE POLICY "cs_members read self or admin" ON public.cs_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.cs_is_admin(auth.uid()));
CREATE POLICY "cs_members admin manage" ON public.cs_members FOR ALL TO authenticated
  USING (public.cs_is_admin(auth.uid())) WITH CHECK (public.cs_is_admin(auth.uid()));

-- crianças
CREATE POLICY "cs_children select assigned or admin" ON public.cs_children FOR SELECT TO authenticated
  USING (public.cs_can_access_child(auth.uid(), id));
CREATE POLICY "cs_children admin insert" ON public.cs_children FOR INSERT TO authenticated
  WITH CHECK (public.cs_is_admin(auth.uid()));
CREATE POLICY "cs_children update with permission" ON public.cs_children FOR UPDATE TO authenticated
  USING (public.cs_has_permission(auth.uid(),'edit_patients'))
  WITH CHECK (public.cs_has_permission(auth.uid(),'edit_patients'));
CREATE POLICY "cs_children delete with permission" ON public.cs_children FOR DELETE TO authenticated
  USING (public.cs_has_permission(auth.uid(),'delete_patients'));

-- atribuições
CREATE POLICY "cs_assignments admin all" ON public.cs_child_assignments FOR ALL TO authenticated
  USING (public.cs_is_admin(auth.uid())) WITH CHECK (public.cs_is_admin(auth.uid()));
CREATE POLICY "cs_assignments read self" ON public.cs_child_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.cs_is_admin(auth.uid()));

-- sessões
CREATE POLICY "cs_sessions select access" ON public.cs_sessions FOR SELECT TO authenticated
  USING (public.cs_can_access_child(auth.uid(), child_id));
CREATE POLICY "cs_sessions insert if active and access" ON public.cs_sessions FOR INSERT TO authenticated
  WITH CHECK (
    public.cs_is_active(auth.uid())
    AND public.cs_can_access_child(auth.uid(), child_id)
    AND professional_id = auth.uid()
  );
CREATE POLICY "cs_sessions update with permission" ON public.cs_sessions FOR UPDATE TO authenticated
  USING (
    public.cs_is_admin(auth.uid())
    OR (professional_id = auth.uid() AND public.cs_has_permission(auth.uid(),'edit_sessions'))
  );
CREATE POLICY "cs_sessions delete with permission" ON public.cs_sessions FOR DELETE TO authenticated
  USING (
    public.cs_is_admin(auth.uid())
    OR (professional_id = auth.uid() AND public.cs_has_permission(auth.uid(),'delete_sessions'))
  );

-- anexos seguem a sessão
CREATE POLICY "cs_att select" ON public.cs_session_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cs_sessions s WHERE s.id = session_id AND public.cs_can_access_child(auth.uid(), s.child_id)));
CREATE POLICY "cs_att insert" ON public.cs_session_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.cs_sessions s WHERE s.id = session_id AND s.professional_id = auth.uid()));
CREATE POLICY "cs_att delete" ON public.cs_session_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cs_sessions s WHERE s.id = session_id AND (s.professional_id = auth.uid() OR public.cs_is_admin(auth.uid()))));

-- ============ STORAGE (bucket session-files) ============
INSERT INTO storage.buckets (id, name, public) VALUES ('session-files','session-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "cs session-files read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'session-files' AND (
  public.cs_is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.cs_sessions s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND public.cs_can_access_child(auth.uid(), s.child_id)
  )
));
CREATE POLICY "cs session-files insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'session-files' AND EXISTS (
  SELECT 1 FROM public.cs_sessions s
  WHERE s.id::text = (storage.foldername(name))[1]
    AND s.professional_id = auth.uid()
));
CREATE POLICY "cs session-files delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'session-files' AND EXISTS (
  SELECT 1 FROM public.cs_sessions s
  WHERE s.id::text = (storage.foldername(name))[1]
    AND (s.professional_id = auth.uid() OR public.cs_is_admin(auth.uid()))
));

-- ============ REVOKES (mesma postura de segurança do módulo original) ============
REVOKE EXECUTE ON FUNCTION public.cs_is_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cs_is_active(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cs_has_permission(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cs_can_access_child(UUID, UUID) FROM PUBLIC, anon;
