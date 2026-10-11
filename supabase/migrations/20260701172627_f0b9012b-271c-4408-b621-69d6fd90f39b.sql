
-- 1. Extend archetypes with the four Bible fields
ALTER TABLE public.archetypes
  ADD COLUMN IF NOT EXISTS core_question text,
  ADD COLUMN IF NOT EXISTS signature_tradeoffs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS commentary_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confidence_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Clear any sessions pointing at archetypes we're about to retire/reseed.
--    FK is ON DELETE SET NULL so a straight delete is safe, but we make it explicit.
UPDATE public.sessions
   SET archetype_id = NULL
 WHERE archetype_id IN (SELECT id FROM public.archetypes WHERE name = 'The Kinetic Romantic');

DELETE FROM public.archetypes WHERE name = 'The Kinetic Romantic';

-- 3. Upsert the ten canonical aesthetic archetypes.
--    signature_axes are 0-100 on existing dimensions.
INSERT INTO public.archetypes (name, tagline, description, core_question, signature_axes, signature_signals, signature_tradeoffs, commentary_keywords, confidence_thresholds)
VALUES
  ('The Architect',
   'How well is it built?',
   'Admires craftsmanship, structure, and intentional design.',
   'How well is it built?',
   '{"movement":55,"atmosphere":55,"groove":55,"darkness":50,"hope":60,"nostalgia":60,"transformation":55,"complexity":92,"melody":80,"verbal_cleverness":88,"authenticity":70,"romanticism":60,"energy":55,"dreaminess":45,"community":50}'::jsonb,
   ARRAY['melody_maximalist','lyrical_wit_seeker'],
   '["Craft > Spontaneity","Precision > Rawness","Structure > Vibe","Complexity > Immediacy"]'::jsonb,
   ARRAY['constructed','deliberate','intricate','rewarding','sophisticated','disciplined','precise','elegant','layered','architectural','engineered','considered','patient','meticulous','clever','composed','intentional','fine-grained','earned','crafted'],
   '{"20":"I wonder if you''re listening for how it''s built.","50":"I''m starting to think craft is what pulls you in.","80":"I''m fairly confident you reward construction over feel.","95":"One thing I''m convinced of: you hear the architecture before the mood."}'::jsonb),

  ('The Romantic',
   'How deeply does it feel?',
   'Values emotional honesty over perfection.',
   'How deeply does it feel?',
   '{"movement":55,"atmosphere":80,"groove":55,"darkness":75,"hope":40,"nostalgia":80,"transformation":60,"complexity":55,"melody":75,"verbal_cleverness":60,"authenticity":90,"romanticism":95,"energy":55,"dreaminess":70,"community":50}'::jsonb,
   ARRAY['cinematic_romantic','beautiful_doom_seeker'],
   '["Feeling > Polish","Vulnerability > Command","Ache > Distance","Sincerity > Irony"]'::jsonb,
   ARRAY['tender','vulnerable','aching','intimate','heartfelt','sincere','exposed','warm','yearning','fragile','confessional','naked','unguarded','wounded','devotional','open','disarming','plainspoken','honest','burning'],
   '{"20":"I wonder if you''re listening for the ache.","50":"I''m starting to think feeling matters more to you than finish.","80":"I''m fairly confident sincerity is your through-line.","95":"One thing I''m convinced of: if it doesn''t bruise, it doesn''t land."}'::jsonb),

  ('The Atmospherist',
   'Where does it take me?',
   'Listens for worlds rather than songs.',
   'Where does it take me?',
   '{"movement":45,"atmosphere":95,"groove":45,"darkness":60,"hope":50,"nostalgia":65,"transformation":65,"complexity":65,"melody":50,"verbal_cleverness":40,"authenticity":60,"romanticism":75,"energy":45,"dreaminess":92,"community":40}'::jsonb,
   ARRAY['texture_astronaut','cinematic_romantic','beautiful_doom_seeker'],
   '["Atmosphere > Statement","Immersion > Immediacy","Space > Hook","Mood > Message"]'::jsonb,
   ARRAY['floating','immersive','cinematic','hazy','expansive','drifting','enveloping','submerged','cavernous','luminous','ambient','weightless','vaporous','dilated','otherworldly','textural','sculptural','sustained','slow-burn','oceanic'],
   '{"20":"I wonder if you''re listening for where it takes you.","50":"I''m starting to think you want a room, not a message.","80":"I''m fairly confident you reward immersion over immediacy.","95":"One thing I''m convinced of: you don''t listen to songs — you step inside them."}'::jsonb),

  ('The Anthemist',
   'Who can I share this with?',
   'Wants music that becomes bigger than the individual.',
   'Who can I share this with?',
   '{"movement":80,"atmosphere":55,"groove":75,"darkness":35,"hope":88,"nostalgia":55,"transformation":70,"complexity":45,"melody":80,"verbal_cleverness":55,"authenticity":70,"romanticism":65,"energy":85,"dreaminess":35,"community":95}'::jsonb,
   ARRAY['communal_lift_seeker','forward_motion_romantic'],
   '["Community > Solitude","Anthem > Whisper","Lift > Restraint","Chorus > Verse"]'::jsonb,
   ARRAY['explosive','soaring','massive','communal','unforgettable','euphoric','triumphant','stadium-sized','collective','arm-raising','singalong','uplifting','cathartic','open-throated','victorious','shared','ecstatic','loud','wide','rousing'],
   '{"20":"I wonder if you''re listening for a room full of people.","50":"I''m starting to think you want music you can share.","80":"I''m fairly confident you''re here for lift, not restraint.","95":"One thing I''m convinced of: a song only lands for you when it belongs to a crowd."}'::jsonb),

  ('The Transformer',
   'Does it change me?',
   'Values journeys over snapshots.',
   'Does it change me?',
   '{"movement":85,"atmosphere":70,"groove":60,"darkness":65,"hope":60,"nostalgia":45,"transformation":95,"complexity":70,"melody":55,"verbal_cleverness":45,"authenticity":80,"romanticism":60,"energy":85,"dreaminess":55,"community":60}'::jsonb,
   ARRAY['catharsis_engine','forward_motion_romantic'],
   '["Journey > Snapshot","Becoming > Being","Payoff > Hook","Motion > Stillness"]'::jsonb,
   ARRAY['unfolding','evolving','becoming','blooming','rising','transforming','cresting','erupting','building','shifting','releasing','breaking-open','cathartic','patient','earned','dynamic','ascending','turning','renewing','arriving'],
   '{"20":"I wonder if you''re listening for where a song goes.","50":"I''m starting to think you want to be moved somewhere.","80":"I''m fairly confident you reward becoming over arriving.","95":"One thing I''m convinced of: a song has to change to earn you."}'::jsonb),

  ('The Seeker',
   'What truth is it chasing?',
   'Values questions more than answers.',
   'What truth is it chasing?',
   '{"movement":55,"atmosphere":70,"groove":45,"darkness":65,"hope":55,"nostalgia":55,"transformation":75,"complexity":80,"melody":55,"verbal_cleverness":80,"authenticity":85,"romanticism":60,"energy":55,"dreaminess":65,"community":45}'::jsonb,
   ARRAY['lyrical_wit_seeker','beautiful_doom_seeker'],
   '["Question > Answer","Meaning > Pleasure","Depth > Immediacy","Search > Certainty"]'::jsonb,
   ARRAY['searching','questioning','wondering','exploring','reaching','contemplating','uncertain','probing','skeptical','curious','existential','restless','open','philosophical','unresolved','honest','patient','doubting','watchful','asking'],
   '{"20":"I wonder if you''re listening for a question, not a hook.","50":"I''m starting to think meaning matters more to you than pleasure.","80":"I''m fairly confident you distrust easy certainty.","95":"One thing I''m convinced of: you''d rather have a good question than a good answer."}'::jsonb),

  ('The Storyteller',
   'What story is it telling?',
   'Listens for characters, journeys, and narrative.',
   'What story is it telling?',
   '{"movement":60,"atmosphere":55,"groove":55,"darkness":60,"hope":55,"nostalgia":75,"transformation":60,"complexity":65,"melody":65,"verbal_cleverness":95,"authenticity":90,"romanticism":65,"energy":55,"dreaminess":45,"community":55}'::jsonb,
   ARRAY['lyrical_wit_seeker','cinematic_romantic'],
   '["Character > Vibe","Narrative > Abstraction","Detail > Slogan","Place > Void"]'::jsonb,
   ARRAY['cinematic','vivid','unfolding','observational','lived-in','specific','novelistic','detailed','peopled','textured','third-person','rendered','witnessing','anecdotal','biographical','plainspoken','American','plotted','patient','memorial'],
   '{"20":"I wonder if you''re listening for the story.","50":"I''m starting to think you want characters, not moods.","80":"I''m fairly confident detail is how a song earns you.","95":"One thing I''m convinced of: a song is a short story to you before it''s anything else."}'::jsonb),

  ('The Hedonist',
   'How good does it feel?',
   'Values pleasure without apology.',
   'How good does it feel?',
   '{"movement":90,"atmosphere":55,"groove":95,"darkness":35,"hope":80,"nostalgia":40,"transformation":55,"complexity":45,"melody":75,"verbal_cleverness":50,"authenticity":60,"romanticism":65,"energy":90,"dreaminess":40,"community":75}'::jsonb,
   ARRAY['bassline_mystic','communal_lift_seeker'],
   '["Body > Mind","Groove > Statement","Pleasure > Meaning","Now > Later"]'::jsonb,
   ARRAY['infectious','irresistible','swaggering','playful','effortless','magnetic','sultry','elastic','strutting','sweaty','loose','buoyant','confident','sensual','pocketed','undeniable','shameless','joyful','rhythmic','alive'],
   '{"20":"I wonder if you''re listening with your body.","50":"I''m starting to think the groove is doing the talking.","80":"I''m fairly confident you reward pleasure over meaning.","95":"One thing I''m convinced of: if it doesn''t move you physically, nothing else matters."}'::jsonb),

  ('The Believer',
   'What does it stand for?',
   'Wants music with conviction.',
   'What does it stand for?',
   '{"movement":70,"atmosphere":55,"groove":60,"darkness":55,"hope":80,"nostalgia":60,"transformation":65,"complexity":55,"melody":65,"verbal_cleverness":70,"authenticity":95,"romanticism":60,"energy":80,"dreaminess":35,"community":80}'::jsonb,
   ARRAY['forward_motion_romantic','communal_lift_seeker'],
   '["Conviction > Irony","Stand > Shrug","Faith > Doubt","Purpose > Play"]'::jsonb,
   ARRAY['steadfast','resolute','unwavering','committed','grounded','purposeful','defiant','hopeful','moral','plainspoken','earnest','plain','built-to-last','carved','anchored','unshaken','unblinking','devout','solid','sure'],
   '{"20":"I wonder if you''re listening for something to stand behind.","50":"I''m starting to think you want music that means it.","80":"I''m fairly confident conviction is what earns you.","95":"One thing I''m convinced of: a song has to believe something to reach you."}'::jsonb),

  ('The Witness',
   'What does it notice?',
   'Values observation over performance.',
   'What does it notice?',
   '{"movement":40,"atmosphere":65,"groove":45,"darkness":55,"hope":55,"nostalgia":70,"transformation":45,"complexity":55,"melody":60,"verbal_cleverness":75,"authenticity":95,"romanticism":60,"energy":40,"dreaminess":55,"community":40}'::jsonb,
   ARRAY['lyrical_wit_seeker','cinematic_romantic'],
   '["Observation > Performance","Restraint > Excess","Quiet > Spectacle","Detail > Drama"]'::jsonb,
   ARRAY['observant','understated','patient','grounded','quiet','genuine','plain','still','watchful','unhurried','clear-eyed','modest','careful','domestic','ordinary','honest','unshowy','restrained','attentive','small'],
   '{"20":"I wonder if you''re listening for what a song notices.","50":"I''m starting to think restraint is what earns you.","80":"I''m fairly confident you distrust spectacle.","95":"One thing I''m convinced of: the quieter it is, the more you hear."}'::jsonb)

ON CONFLICT (name) DO UPDATE SET
  tagline               = EXCLUDED.tagline,
  description           = EXCLUDED.description,
  core_question         = EXCLUDED.core_question,
  signature_axes        = EXCLUDED.signature_axes,
  signature_signals     = EXCLUDED.signature_signals,
  signature_tradeoffs   = EXCLUDED.signature_tradeoffs,
  commentary_keywords   = EXCLUDED.commentary_keywords,
  confidence_thresholds = EXCLUDED.confidence_thresholds,
  updated_at            = now();
