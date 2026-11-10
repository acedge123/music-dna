CREATE OR REPLACE FUNCTION public.bind_critic_quality_output() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_TABLE_NAME='session_results' THEN
  UPDATE public.critic_quality_attempts SET result_version=NEW.version WHERE session_id=NEW.session_id AND user_id=NEW.user_id AND result_version IS NULL AND stage='reveal' AND (output_text=NEW.content->>'synthesis' OR output_text=NEW.content->>'narrative');
 ELSIF TG_TABLE_NAME='chat_messages' AND NEW.role='assistant' THEN
  UPDATE public.critic_quality_attempts SET evidence_context=evidence_context || jsonb_build_object('saved_chat_message_id',NEW.id) WHERE session_id=NEW.session_id AND user_id=NEW.user_id AND stage='chat' AND output_text=NEW.content AND NOT evidence_context ? 'saved_chat_message_id';
 END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.bind_critic_quality_output() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_critic_quality_output() TO service_role;
CREATE TRIGGER bind_critic_quality_result AFTER INSERT ON public.session_results FOR EACH ROW EXECUTE FUNCTION public.bind_critic_quality_output();
CREATE TRIGGER bind_critic_quality_chat AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.bind_critic_quality_output();