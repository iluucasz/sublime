UPDATE public.assessment_items
SET group_label = 'Comunicação Básica'
WHERE assessment_id = 'a4cc07e9-1365-46a1-9410-2fd9d885821c'
  AND group_label IS NULL
  AND name LIKE 'BC%';