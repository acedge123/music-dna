CREATE TABLE public.prepared_reads (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answered integer NOT NULL,
  pairing_id uuid NOT NULL,
  chosen_song_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed')),
  fingerprint text,
  payload jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  PRIMARY KEY (session_id, answered, pairing_id, chosen_song_id)
);
GRANT ALL ON public.prepared_reads TO service_role;
REVOKE ALL ON public.prepared_reads FROM anon, authenticated;
ALTER TABLE public.prepared_reads ENABLE ROW LEVEL SECURITY;