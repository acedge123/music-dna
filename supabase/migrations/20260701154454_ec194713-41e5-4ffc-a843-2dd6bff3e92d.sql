
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS archetype_top3 jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS archetype_score numeric,
  ADD COLUMN IF NOT EXISTS archetype_margin numeric,
  ADD COLUMN IF NOT EXISTS archetype_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archetype_flag_reason text;

CREATE INDEX IF NOT EXISTS sessions_archetype_flagged_idx
  ON public.sessions (completed_at DESC)
  WHERE archetype_flagged = true;

COMMENT ON COLUMN public.sessions.archetype_top3 IS
  'Top 3 candidate archetypes: [{archetype_id, name, score}]. Used for residual review — did any listener escape all current archetypes?';
COMMENT ON COLUMN public.sessions.archetype_flag_reason IS
  'One of: low_score (best < threshold), ambiguous (margin < threshold), no_archetypes.';
