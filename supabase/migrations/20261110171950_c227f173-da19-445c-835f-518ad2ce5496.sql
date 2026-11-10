CREATE TABLE public.song_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  text text NOT NULL,
  source_url text,
  source_title text,
  confidence smallint NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'draft',
  check_note text,
  drafted_by text NOT NULL DEFAULT 'ai-research-v1',
  reviewed_by uuid,
  reviewed_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_facts TO authenticated;
GRANT ALL ON public.song_facts TO service_role;
ALTER TABLE public.song_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage song facts" ON public.song_facts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX song_facts_song_idx ON public.song_facts(song_id, status);

CREATE OR REPLACE FUNCTION public.validate_song_fact() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind NOT IN ('sound','arrangement_production','influences','cultural_context','distinctive_moment') THEN
    RAISE EXCEPTION 'invalid song fact kind %', NEW.kind; END IF;
  IF NEW.status NOT IN ('draft','needs_human','approved','rejected') THEN
    RAISE EXCEPTION 'invalid song fact status %', NEW.status; END IF;
  IF NEW.confidence < 0 OR NEW.confidence > 100 THEN RAISE EXCEPTION 'confidence out of range'; END IF;
  IF length(btrim(NEW.text)) < 8 OR length(NEW.text) > 300 THEN RAISE EXCEPTION 'fact text length'; END IF;
  IF NEW.status = 'approved' AND (NEW.source_url IS NULL OR NEW.source_url !~ '^https://') THEN
    RAISE EXCEPTION 'approved facts need an https source'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.text IS DISTINCT FROM OLD.text THEN NEW.version := OLD.version + 1; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER song_facts_validate BEFORE INSERT OR UPDATE ON public.song_facts
  FOR EACH ROW EXECUTE FUNCTION public.validate_song_fact();