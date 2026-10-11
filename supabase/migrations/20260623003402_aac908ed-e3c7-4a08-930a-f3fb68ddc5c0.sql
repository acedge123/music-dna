
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS routing_power smallint,
  ADD COLUMN IF NOT EXISTS sub_lane text,
  ADD COLUMN IF NOT EXISTS rationale text;

ALTER TABLE public.pairings
  ADD COLUMN IF NOT EXISTS expected_split text;
