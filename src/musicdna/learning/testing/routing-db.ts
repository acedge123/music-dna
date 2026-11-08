import { createOutboxTestDatabase, readSourceFile } from "./outbox-db";

export async function createRoutingTestDatabase() {
  const f = await createOutboxTestDatabase(true);
  await f.sql.unsafe(`
      ALTER TABLE public.sessions ADD COLUMN created_at timestamptz DEFAULT now(), ADD COLUMN lane_confidence numeric, ADD COLUMN probe_state jsonb, ADD COLUMN bootstrap_choices_json jsonb;
      CREATE TABLE public.songs(id uuid PRIMARY KEY,title text,artist text,year integer,lane text,primary_lane text,movement numeric);
      CREATE TABLE public.pairings(id uuid PRIMARY KEY,song_a_id uuid,song_b_id uuid,tests text[],diagnostic_weight integer,updated_at timestamptz DEFAULT now());
      CREATE TABLE public.choices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid REFERENCES public.sessions ON DELETE CASCADE,pairing_id uuid,chosen_song_id uuid,rejected_song_id uuid,ms_to_decide integer,mutation_id text,response jsonb,created_at timestamptz DEFAULT now(),UNIQUE(session_id,pairing_id));
      GRANT SELECT ON public.songs,public.pairings TO authenticated; GRANT ALL ON public.songs,public.pairings,public.choices TO service_role;
      GRANT SELECT,INSERT,UPDATE,DELETE ON public.choices TO authenticated;
      ALTER TABLE public.choices ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner_choice ON public.choices TO authenticated USING(EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.user_id=auth.uid()));
      ALTER TABLE public.event_log ADD COLUMN pairing_id uuid, ADD COLUMN created_at timestamptz DEFAULT now();
      GRANT SELECT,INSERT ON public.event_log TO authenticated; GRANT ALL ON public.event_log TO service_role;
      ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "users read their own events" ON public.event_log FOR SELECT TO authenticated USING(user_id=auth.uid());
    `);
  for (const path of [
    "20261010225852_46b67d37-547c-453f-a3b9-98c6022b2c13.sql",
    "20261010230343_550c1bac-d6cc-412d-a07e-366aaa2c58f8.sql",
    "20261011002528_0ab943b0-4fa4-4b13-b201-466c879193d2.sql",
    "20261108175602_musicdna_applied_outcomes.sql",
  ])
    await f.sql.unsafe(readSourceFile("supabase/migrations/" + path));

  return f;
}
