CREATE OR REPLACE FUNCTION public.bind_critic_quality_output() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=NEW.session_id AND user_id=NEW.user_id) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='session_results' THEN
  UPDATE public.critic_quality_attempts SET result_version=NEW.version WHERE session_id=NEW.session_id AND user_id=NEW.user_id AND result_version IS NULL AND stage='reveal' AND (output_text=NEW.content->>'synthesis' OR output_text=NEW.content->>'narrative');
 ELSIF TG_TABLE_NAME='chat_messages' AND NEW.role='assistant' THEN
  UPDATE public.critic_quality_attempts SET evidence_context=evidence_context || jsonb_build_object('saved_chat_message_id',NEW.id) WHERE session_id=NEW.session_id AND user_id=NEW.user_id AND stage='chat' AND output_text=NEW.content AND NOT evidence_context ? 'saved_chat_message_id';
 END IF; RETURN NEW;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'critic quality linking unavailable'; RETURN NEW;
 END $$;
REVOKE ALL ON FUNCTION public.bind_critic_quality_output() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_critic_quality_output() TO service_role;