
-- 1) Duplicate-choice guard
ALTER TABLE public.choices
  ADD CONSTRAINT choices_session_pairing_unique UNIQUE (session_id, pairing_id);

-- 2) Share tokens for public reading links
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

UPDATE public.sessions
  SET share_token = encode(gen_random_bytes(12), 'hex')
  WHERE share_token IS NULL;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_share_token_unique UNIQUE (share_token);

CREATE OR REPLACE FUNCTION public.sessions_assign_share_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.share_token IS NULL THEN
    NEW.share_token := encode(gen_random_bytes(12), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_assign_share_token_trg ON public.sessions;
CREATE TRIGGER sessions_assign_share_token_trg
  BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.sessions_assign_share_token();

-- 3) Tighten chat_messages: require session ownership, not just user_id match
DROP POLICY IF EXISTS "Users insert their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users read their own chat messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users delete their own chat messages" ON public.chat_messages;

CREATE POLICY "Users read their own chat messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert their own chat messages" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users delete their own chat messages" ON public.chat_messages
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
    )
  );

-- 4) Tighten event_log: when a session_id is supplied, it must belong to the user
DROP POLICY IF EXISTS "users insert their own events" ON public.event_log;
CREATE POLICY "users insert their own events" ON public.event_log
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND (
      session_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.sessions s
        WHERE s.id = event_log.session_id AND s.user_id = auth.uid()
      )
    )
  );

-- 5) Tighten result_feedback: session must belong to the user
DROP POLICY IF EXISTS "users manage their own feedback" ON public.result_feedback;
CREATE POLICY "users manage their own feedback" ON public.result_feedback
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = result_feedback.session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = result_feedback.session_id AND s.user_id = auth.uid()
    )
  );
