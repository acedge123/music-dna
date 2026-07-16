ALTER TABLE public.result_feedback
  ADD COLUMN IF NOT EXISTS most_accurate_sentence text,
  ADD COLUMN IF NOT EXISTS least_accurate_sentence text;

CREATE OR REPLACE VIEW public.v_session_stability
WITH (security_invoker=on) AS
SELECT
  e.session_id,
  (e.props->>'round')::int                          AS round_number,
  e.props->>'winner_archetype_id'                   AS winner_archetype_id,
  (e.props->>'winner_fit')::numeric                 AS winner_fit,
  (e.props->>'margin')::numeric                     AS margin,
  (e.props->>'is_final')::boolean                   AS is_final,
  e.created_at
FROM public.event_log e
WHERE e.event_type = 'archetype_ranking_snapshot';

CREATE OR REPLACE VIEW public.v_axis_independence
WITH (security_invoker=on) AS
WITH final_winner AS (
  SELECT DISTINCT ON (session_id)
    session_id,
    props->>'winner_archetype_id' AS winner_archetype_id
  FROM public.event_log
  WHERE event_type = 'archetype_ranking_snapshot'
    AND (props->>'is_final')::boolean IS TRUE
  ORDER BY session_id, created_at DESC
),
scored AS (
  SELECT
    e.session_id,
    fw.winner_archetype_id,
    jsonb_array_elements_text(
      COALESCE(e.props->'supports_by_archetype'->fw.winner_archetype_id, '[]'::jsonb)
    ) AS supporting_axis
  FROM public.event_log e
  JOIN final_winner fw ON fw.session_id = e.session_id
  WHERE e.event_type = 'choice_scored'
)
SELECT
  session_id,
  winner_archetype_id,
  COUNT(*)                                AS total_supports,
  COUNT(DISTINCT supporting_axis)         AS distinct_supporting_axes
FROM scored
GROUP BY session_id, winner_archetype_id;

CREATE OR REPLACE VIEW public.v_contradiction_load
WITH (security_invoker=on) AS
WITH final_winner AS (
  SELECT DISTINCT ON (session_id)
    session_id,
    props->>'winner_archetype_id' AS winner_archetype_id
  FROM public.event_log
  WHERE event_type = 'archetype_ranking_snapshot'
    AND (props->>'is_final')::boolean IS TRUE
  ORDER BY session_id, created_at DESC
)
SELECT
  e.session_id,
  fw.winner_archetype_id,
  COALESCE(SUM((e.props->'contribution_by_archetype'->>fw.winner_archetype_id)::numeric)
    FILTER (WHERE (e.props->'contribution_by_archetype'->>fw.winner_archetype_id)::numeric > 0), 0) AS positive_contribution,
  COALESCE(SUM((e.props->'contribution_by_archetype'->>fw.winner_archetype_id)::numeric)
    FILTER (WHERE (e.props->'contribution_by_archetype'->>fw.winner_archetype_id)::numeric < 0), 0) AS negative_contribution
FROM public.event_log e
JOIN final_winner fw ON fw.session_id = e.session_id
WHERE e.event_type = 'choice_scored'
GROUP BY e.session_id, fw.winner_archetype_id;

CREATE OR REPLACE VIEW public.v_residual_rate
WITH (security_invoker=on) AS
SELECT DISTINCT ON (session_id)
  session_id,
  (props->>'winner_fit')::numeric   AS winner_fit,
  (props->>'margin')::numeric       AS margin,
  CASE
    WHEN (props->>'winner_fit')::numeric < 0.55 OR (props->>'margin')::numeric < 0.05
    THEN TRUE ELSE FALSE
  END                                AS is_residual,
  created_at
FROM public.event_log
WHERE event_type = 'archetype_ranking_snapshot'
  AND (props->>'is_final')::boolean IS TRUE
ORDER BY session_id, created_at DESC;

CREATE OR REPLACE VIEW public.v_human_agreement
WITH (security_invoker=on) AS
SELECT
  rf.session_id,
  rf.accuracy,
  rf.most_accurate_sentence,
  rf.least_accurate_sentence,
  vr.winner_fit,
  vr.margin,
  vr.is_residual
FROM public.result_feedback rf
LEFT JOIN public.v_residual_rate vr ON vr.session_id = rf.session_id;

GRANT SELECT ON public.v_session_stability   TO service_role;
GRANT SELECT ON public.v_axis_independence   TO service_role;
GRANT SELECT ON public.v_contradiction_load  TO service_role;
GRANT SELECT ON public.v_residual_rate       TO service_role;
GRANT SELECT ON public.v_human_agreement     TO service_role;