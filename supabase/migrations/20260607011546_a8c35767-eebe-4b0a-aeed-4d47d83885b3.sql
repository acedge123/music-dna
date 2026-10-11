CREATE OR REPLACE FUNCTION public.sessions_assign_share_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.share_token IS NULL THEN
    NEW.share_token := encode(extensions.gen_random_bytes(12), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;