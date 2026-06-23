
ALTER TABLE public.reports
  ADD CONSTRAINT reports_patient_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

ALTER TABLE public.report_sections
  ADD CONSTRAINT report_sections_specialty_fk FOREIGN KEY (specialty_id) REFERENCES public.specialties(id) ON DELETE SET NULL,
  ADD CONSTRAINT report_sections_professional_fk FOREIGN KEY (professional_id) REFERENCES public.professionals(id) ON DELETE SET NULL;
