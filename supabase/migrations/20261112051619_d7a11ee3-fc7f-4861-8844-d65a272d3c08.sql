CREATE TABLE public.archetype_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype_id uuid NOT NULL REFERENCES public.archetypes(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  core jsonb NOT NULL DEFAULT '{}'::jsonb,
  supporting jsonb NOT NULL DEFAULT '{}'::jsonb,
  distinguishers text,
  thematic_note text,
  status text NOT NULL DEFAULT 'draft',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (archetype_id, version)
);
GRANT SELECT, INSERT, UPDATE ON public.archetype_profiles TO authenticated;
GRANT ALL ON public.archetype_profiles TO service_role;
ALTER TABLE public.archetype_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved archetype profiles are readable" ON public.archetype_profiles FOR SELECT TO authenticated
  USING (status = 'approved' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write archetype profiles" ON public.archetype_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update archetype profiles" ON public.archetype_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_archetype_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE k text; v jsonb;
BEGIN
  IF NEW.status NOT IN ('draft','approved','retired') THEN RAISE EXCEPTION 'invalid profile status'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(NEW.core || NEW.supporting) LOOP
    IF k NOT IN ('movement','atmosphere','immersion','scale','community','perspective','confidence','tension','texture','transformation') THEN
      RAISE EXCEPTION 'unknown trait %', k; END IF;
    IF jsonb_typeof(v) <> 'number' OR (v::text)::numeric < -1 OR (v::text)::numeric > 1 THEN
      RAISE EXCEPTION 'trait weight must be between -1 and 1'; END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER archetype_profiles_validate BEFORE INSERT OR UPDATE ON public.archetype_profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_archetype_profile();

CREATE TABLE public.song_trait_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  axis text NOT NULL,
  score_at_write smallint NOT NULL,
  audible_evidence text NOT NULL,
  interpretation text NOT NULL,
  confidence text NOT NULL DEFAULT 'pending_review',
  status text NOT NULL DEFAULT 'pending_review',
  scoring_version text,
  drafted_by text NOT NULL DEFAULT 'sol',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (song_id, axis, score_at_write)
);
GRANT SELECT, INSERT, UPDATE ON public.song_trait_explanations TO authenticated;
GRANT ALL ON public.song_trait_explanations TO service_role;
ALTER TABLE public.song_trait_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved song explanations are readable" ON public.song_trait_explanations FOR SELECT TO authenticated
  USING (status = 'approved' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write song explanations" ON public.song_trait_explanations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update song explanations" ON public.song_trait_explanations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_song_trait_explanation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.axis NOT IN ('movement','atmosphere','immersion','scale','community','perspective','confidence','tension','texture','transformation') THEN
    RAISE EXCEPTION 'unknown trait %', NEW.axis; END IF;
  IF NEW.status NOT IN ('pending_review','approved','rejected') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF length(trim(NEW.audible_evidence)) < 10 OR length(trim(NEW.interpretation)) < 10 THEN
    RAISE EXCEPTION 'explanation too short'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER song_trait_explanations_validate BEFORE INSERT OR UPDATE ON public.song_trait_explanations
FOR EACH ROW EXECUTE FUNCTION public.validate_song_trait_explanation();

INSERT INTO public.archetype_profiles (archetype_id, core, distinguishers, thematic_note)
SELECT a.id, d.core::jsonb, d.dist, d.theme FROM public.archetypes a JOIN (VALUES
 ('The Architect','{"texture":1,"confidence":0.7}','Craft and control; unlike the Believer, conviction comes from construction, not statement.',NULL),
 ('The Romantic','{"perspective":-1,"confidence":-0.8,"scale":-0.6}','Feeling and vulnerability up close; unlike the Witness, inside the emotion rather than observing it.',NULL),
 ('The Atmospherist','{"atmosphere":1,"immersion":0.8}','Mood and slow reveal; unlike the Transformer, the space matters more than the journey.',NULL),
 ('The Anthemist','{"community":1,"scale":0.8,"movement":0.6}','Big, shared and moving; unlike the Hedonist, the crowd matters more than the rush.',NULL),
 ('The Transformer','{"transformation":1,"immersion":0.6}','Songs that go somewhere; unlike the Seeker, the change is musical, not thematic.',NULL),
 ('The Seeker','{"transformation":0.8,"immersion":0.7}','Shares the Transformer''s traits; separated mainly by lyrical searching.','Partly defined by lyrical meaning the ten traits cannot measure; needs thematic evidence before confirmation.'),
 ('The Storyteller','{"perspective":1,"immersion":0.6,"scale":-0.5}','Observation unfolding up close; unlike the Witness, narrative patience over restraint.',NULL),
 ('The Hedonist','{"movement":1,"immersion":-0.7,"tension":-0.6}','Immediate motion and release; unlike the Anthemist, the rush over the crowd.',NULL),
 ('The Believer','{"confidence":1,"atmosphere":-0.7,"community":0.6}','Command and statement, shared; separated from the Architect by conviction.','Partly defined by conviction in the lyrics; needs thematic evidence before confirmation.'),
 ('The Witness','{"perspective":0.8,"scale":-0.6,"movement":-0.5}','Observation, intimacy and restraint; unlike the Storyteller, stillness over narrative.',NULL)
) AS d(name, core, dist, theme) ON d.name = a.name;