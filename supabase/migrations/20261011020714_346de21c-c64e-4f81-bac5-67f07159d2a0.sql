ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS mutation_id text;

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_session_mutation_unique
  ON public.chat_messages (session_id, mutation_id)
  WHERE mutation_id IS NOT NULL;