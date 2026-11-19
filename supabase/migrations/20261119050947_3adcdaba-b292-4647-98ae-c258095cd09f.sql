ALTER TABLE public.song_trait_explanations
 ADD COLUMN score_disputed boolean NOT NULL DEFAULT false,
 ADD COLUMN suggested_score smallint CHECK (suggested_score BETWEEN 0 AND 100),
 ADD COLUMN score_dispute_reason text,
 ADD COLUMN model_review_verdict text CHECK (model_review_verdict IN ('pass','fail'));
COMMENT ON COLUMN public.song_trait_explanations.suggested_score IS 'Advisory AI proposal only; never applied automatically to songs.';
COMMENT ON COLUMN public.song_trait_explanations.model_review_verdict IS 'Independent review outcome for newly drafted explanations; NULL means historical/unrecorded.';