
-- Permitir leitura anônima das listas de especialidades e unidades (necessário no signup)
GRANT SELECT ON public.specialties TO anon, authenticated;
GRANT SELECT ON public.units TO anon, authenticated;

DROP POLICY IF EXISTS specialties_select ON public.specialties;
CREATE POLICY specialties_select ON public.specialties FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS units_select ON public.units;
CREATE POLICY units_select ON public.units FOR SELECT TO anon, authenticated USING (true);
