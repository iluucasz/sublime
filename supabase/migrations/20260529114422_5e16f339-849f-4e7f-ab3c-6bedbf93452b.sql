
UPDATE public.report_template_modules
SET title = regexp_replace(title, '^Anexo\s+\d+\s*[—–-]\s*', '')
WHERE title ~ '^Anexo\s+\d+';

UPDATE public.report_sections
SET title = regexp_replace(title, '^Anexo\s+\d+\s*[—–-]\s*', '')
WHERE title ~ '^Anexo\s+\d+';
