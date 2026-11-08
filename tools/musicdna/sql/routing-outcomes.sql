-- Operator diagnostics only. Run as the authorized service/operator, never a listener client.
-- Replace the nil UUID with one approved synthetic result ID. No automatic activation.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT public.read_musicdna_routing_outcome('00000000-0000-4000-8000-000000000000'::uuid) AS outcome;
SELECT p.proname, p.prosecdef AS security_definer,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS listener_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('assign_musicdna_routing_experiment','read_musicdna_routing_outcome');
COMMIT;
