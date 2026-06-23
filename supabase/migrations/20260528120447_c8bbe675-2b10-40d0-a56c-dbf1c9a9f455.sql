
-- Professionals: novos campos
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS council_type TEXT,
  ADD COLUMN IF NOT EXISTS stamp_url TEXT,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS schedule_text TEXT;

-- Patients: birth_date opcional + datas do pedido médico
ALTER TABLE public.patients
  ALTER COLUMN birth_date DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS medical_order_date DATE,
  ADD COLUMN IF NOT EXISTS medical_order_expires_at DATE;

-- Especialidades
INSERT INTO public.specialties (name, color) VALUES
  ('ABA', '#2C2E6B'),
  ('Avaliação Neuropsicológica', '#6BB6E3'),
  ('Cozinha Terapêutica', '#F5C842'),
  ('Fisioterapia', '#E55D87'),
  ('Fonoaudiologia', '#F26B3A'),
  ('Musicoterapia', '#9B59B6'),
  ('Psicologia', '#3498DB'),
  ('Psicomotricidade', '#1ABC9C'),
  ('Psicopedagogia', '#E67E22'),
  ('Sala de THS', '#34495E'),
  ('Terapia Alimentar', '#16A085'),
  ('Terapia Ocupacional', '#C0392B')
ON CONFLICT DO NOTHING;

-- Unidades
INSERT INTO public.units (name) VALUES
  ('Laranjeiras'),
  ('São João de Meriti')
ON CONFLICT DO NOTHING;

-- Storage bucket público para carimbos e assinaturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('professional-stamps', 'professional-stamps', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Stamps publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'professional-stamps');

CREATE POLICY "Authenticated can upload stamps"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'professional-stamps');

CREATE POLICY "Authenticated can update stamps"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'professional-stamps');

CREATE POLICY "Authenticated can delete stamps"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'professional-stamps');
