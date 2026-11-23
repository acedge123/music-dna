-- Identity-only guest search. Existing songs table grants and RLS stay unchanged.
CREATE FUNCTION public.musicdna_search_normalize(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog
AS $$
 SELECT trim(regexp_replace(
   replace(replace(translate(lower(p_text),
   'áàâäãåāăąéèêëēėęěíìîïīįıóòôöõøōőúùûüūůűýÿñńňçćčšśžźżð',
   'aaaaaaaaaeeeeeeeeiiiiiiioooooooouuuuuuuyynnncccsszzzd'), '''', ''), '’', ''),
   '[^a-z0-9]+', ' ', 'g'))
$$;
REVOKE ALL ON FUNCTION public.musicdna_search_normalize(text) FROM PUBLIC;

CREATE FUNCTION public.musicdna_public_song_search(p_query text)
RETURNS TABLE(id uuid, title text, artist text, year integer, listen_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
SET statement_timeout = '3s'
AS $$
 WITH query AS (
   SELECT public.musicdna_search_normalize(left(coalesce(p_query,''),120)) AS q
 ), identities AS (
   SELECT s.id,s.title,s.artist,s.year,0::bigint AS listen_count,0 AS source_order
   FROM public.songs s WHERE s.active = true
   UNION ALL
   SELECT r.id,r.title,r.artist,NULL::integer,r.listen_count,1
   FROM public.song_recognition r
 ), normalized AS (
   SELECT i.*,public.musicdna_search_normalize(i.title) AS t,
     public.musicdna_search_normalize(i.artist) AS a FROM identities i
 ), candidates AS (
   SELECT n.*,q.q FROM normalized n CROSS JOIN query q
   WHERE length(q.q)>=2 AND EXISTS (
     SELECT 1 FROM regexp_split_to_table(q.q,' ') AS token
     CROSS JOIN regexp_split_to_table(n.t || ' ' || n.a,' ') AS word
     WHERE length(token)>=2 AND left(word,2)=left(token,2)
   )
 )
 SELECT c.id,c.title,c.artist,c.year,c.listen_count FROM candidates c
 ORDER BY (c.t=c.q OR c.a=c.q) DESC,
   (c.t || ' ' || c.a=c.q OR c.a || ' ' || c.t=c.q) DESC,
   (NOT EXISTS (SELECT 1 FROM regexp_split_to_table(c.q,' ') token
      WHERE NOT EXISTS (SELECT 1 FROM regexp_split_to_table(c.t || ' ' || c.a,' ') word
        WHERE starts_with(word,token)))) DESC,
   c.source_order,c.listen_count DESC,c.title,c.artist,c.id
 LIMIT 400
$$;
REVOKE ALL ON FUNCTION public.musicdna_public_song_search(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.musicdna_public_song_search(text) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.musicdna_public_song_search(text) IS
 'Bounded public song identities only; no scores, lanes, evidence, listener data or writes. Recognition years withheld.';