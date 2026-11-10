ALTER TABLE public.prepared_reads
  ADD COLUMN requested_at timestamptz,
  ADD COLUMN consumed_at timestamptz,
  ADD COLUMN outcome text CHECK (outcome IS NULL OR outcome IN ('used','mismatch','failed','not_ready','missing')),
  ADD COLUMN wait_ms integer;