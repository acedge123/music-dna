-- Isolated test database only. Minimal schema models authenticated RLS and the existing RPC.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.songs (id uuid PRIMARY KEY, title text, artist text, year integer,
  lane text, primary_lane text, scale numeric, tension numeric);
CREATE TABLE public.pairings (id uuid PRIMARY KEY, song_a_id uuid, song_b_id uuid,
  tests text[], diagnostic_weight numeric, updated_at timestamptz, hypothesis text);
CREATE TABLE public.sessions (id uuid PRIMARY KEY, user_id uuid, vector jsonb, lane text,
  lane_confidence numeric, probe_state jsonb, bootstrap_choices_json jsonb);
CREATE TABLE public.choices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid,
  pairing_id uuid, chosen_song_id uuid, rejected_song_id uuid, ms_to_decide integer,
  mutation_id text, response jsonb, created_at timestamptz DEFAULT now(), UNIQUE(session_id, pairing_id));
GRANT ALL ON public.songs, public.sessions, public.choices TO authenticated;
GRANT UPDATE ON public.pairings TO authenticated;
GRANT SELECT (id,song_a_id,song_b_id,tests,diagnostic_weight,updated_at) ON public.pairings TO authenticated;
ALTER TABLE public.pairings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listener_pairings ON public.pairings FOR SELECT TO authenticated USING (true);
CREATE POLICY curator_pairings ON public.pairings FOR UPDATE TO authenticated USING (false);
ALTER TABLE public.choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_choice ON public.choices TO authenticated USING
  (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_session ON public.sessions TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
INSERT INTO songs VALUES
  ('00000000-0000-0000-0000-000000000001','A','X',1980,'pop','pop',90,NULL),
  ('00000000-0000-0000-0000-000000000002','B','Y',1990,'pop','pop',10,50);
INSERT INTO pairings VALUES
  ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',ARRAY['scale','scale','fake','tension'],100,now(),'private');
INSERT INTO sessions VALUES
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005','{}','pop',0,'{}','[]');
-- Legacy row is inserted BEFORE migration, and must remain unbackfilled.
INSERT INTO choices(session_id,pairing_id,chosen_song_id) VALUES
  ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001');
