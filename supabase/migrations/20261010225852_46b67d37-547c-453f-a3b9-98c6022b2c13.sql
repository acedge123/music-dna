DROP POLICY IF EXISTS "users insert their own events" ON public.event_log;
CREATE POLICY "users insert their own events" ON public.event_log
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND event_type NOT IN ('read_shown','pairing_skipped','reaction_submitted','self_report','choice_scored','archetype_ranking_snapshot','regime_recommended')
    AND (
      session_id IS NULL
      OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = event_log.session_id AND s.user_id = auth.uid())
    )
  );
GRANT ALL ON public.event_log TO service_role;