ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS warranty_start_date date,
  ADD COLUMN IF NOT EXISTS warranty_months integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS warranty_copies integer NOT NULL DEFAULT 60000,
  ADD COLUMN IF NOT EXISTS counter_start integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counter_current integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counter_updated_at timestamp with time zone;