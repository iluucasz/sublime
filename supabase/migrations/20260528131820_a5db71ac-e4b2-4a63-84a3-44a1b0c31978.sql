-- Adiciona definição de campos do tipo formulário em módulos de modelo
ALTER TABLE public.report_template_modules
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Snapshot dos campos no momento da criação do relatório + valores preenchidos
ALTER TABLE public.report_sections
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS field_values jsonb NOT NULL DEFAULT '{}'::jsonb;