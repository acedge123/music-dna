-- Replace only the experiment code. Run as an authorized operator.
-- The result is private LOCAL analysis input, never a learning-observation wire payload.
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT public.read_musicdna_pilot_cohort('ab52.owner-qa.v1',statement_timestamp()) AS cohort;
COMMIT;
