
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS scoring_version text,
  ADD COLUMN IF NOT EXISTS scored_at timestamptz,
  ADD COLUMN IF NOT EXISTS scoring_provenance jsonb;
COMMENT ON COLUMN public.songs.scoring_provenance IS 'Snapshot of prior axis values + model/provenance from most recent LLM backfill.';
