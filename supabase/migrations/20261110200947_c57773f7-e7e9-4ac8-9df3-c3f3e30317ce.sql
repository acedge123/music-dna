CREATE TABLE public.critic_reaction_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id uuid NOT NULL REFERENCES public.pairings(id) ON DELETE CASCADE,
  chosen_song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'picks_1_4' CHECK (stage IN ('picks_1_4')),
  writer_version text NOT NULL,
  reviewer_version text NOT NULL,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','retired','rejected')),
  evidence_fingerprint text NOT NULL,
  text text NOT NULL,
  source text NOT NULL CHECK (source IN ('speculative_unused','fill_script')),
  retired_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pairing_id, chosen_song_id, evidence_fingerprint, text)
);
CREATE INDEX critic_reaction_pool_lookup ON public.critic_reaction_pool (pairing_id, chosen_song_id, status);
GRANT ALL ON public.critic_reaction_pool TO service_role;
REVOKE ALL ON public.critic_reaction_pool FROM anon, authenticated;
ALTER TABLE public.critic_reaction_pool ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER critic_reaction_pool_updated_at BEFORE UPDATE ON public.critic_reaction_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.critic_reaction_exposures (
  user_id uuid NOT NULL,
  pool_id uuid NOT NULL REFERENCES public.critic_reaction_pool(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  shown_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pool_id)
);
GRANT ALL ON public.critic_reaction_exposures TO service_role;
REVOKE ALL ON public.critic_reaction_exposures FROM anon, authenticated;
ALTER TABLE public.critic_reaction_exposures ENABLE ROW LEVEL SECURITY;