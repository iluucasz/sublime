-- =====================================================================
-- MÓDULO DIA A DIA — papéis novos no enum app_role do principal
-- Origem: projeto Supabase yhpfddvvlmiwhwihjgve (Sublime Dia a Dia)
--
-- Estes ADD VALUE ficam em migration SEPARADA da que os usa (tabelas/RLS),
-- porque o Postgres não permite usar um valor de enum recém-adicionado na
-- mesma transação em que ele foi criado.
--
-- Observação: "admin" do Dia a Dia NÃO vira um valor de enum — ele mapeia
-- para a administração do principal (diretoria/operador) via dd_is_admin().
-- =====================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reception';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer_success';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'avisos';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'blog_author';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'podcast_author';
