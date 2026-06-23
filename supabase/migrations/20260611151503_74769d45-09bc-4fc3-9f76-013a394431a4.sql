
ALTER TABLE public.therapy_grid
  ADD COLUMN IF NOT EXISTS weekday smallint,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS integrated_note text;

ALTER TABLE public.therapy_grid ALTER COLUMN weekly_frequency DROP NOT NULL;
ALTER TABLE public.therapy_grid ALTER COLUMN weekly_frequency SET DEFAULT NULL;

ALTER TABLE public.therapy_grid
  ADD CONSTRAINT therapy_grid_weekday_check CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6));
