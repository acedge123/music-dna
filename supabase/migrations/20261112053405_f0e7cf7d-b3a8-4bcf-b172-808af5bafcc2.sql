UPDATE public.archetype_profiles p SET core = '{"transformation":1,"immersion":0.6,"movement":0.4}'::jsonb,
  distinguishers = 'Songs that travel: transformation leads, with patience and forward drive; unlike the Seeker, the change is musical, not thematic.'
FROM public.archetypes a WHERE a.id = p.archetype_id AND a.name = 'The Transformer';

UPDATE public.archetype_profiles p SET status = 'approved', approved_at = now(),
  approved_by = (SELECT id FROM auth.users WHERE email = 'alan@thegig.agency' LIMIT 1)
FROM public.archetypes a WHERE a.id = p.archetype_id
  AND a.name IN ('The Anthemist','The Atmospherist','The Hedonist','The Romantic','The Transformer','The Witness');

UPDATE public.archetype_profiles p SET core = '{"texture":1,"confidence":0.6,"tension":0.3}'::jsonb,
  distinguishers = 'Craftsmanship with control and a little edge; unlike the Believer, conviction comes from construction.',
  thematic_note = 'Craftsmanship is only partly captured by refinement and command; needs review of song-level explanations before approval.'
FROM public.archetypes a WHERE a.id = p.archetype_id AND a.name = 'The Architect';

UPDATE public.archetype_profiles p SET
  thematic_note = 'Narrative lyric storytelling is not directly measured by the ten traits; needs thematic evidence before confirmation.'
FROM public.archetypes a WHERE a.id = p.archetype_id AND a.name = 'The Storyteller';

UPDATE public.archetype_profiles p SET core = '{"perspective":0.7,"transformation":0.6,"scale":0.6,"atmosphere":0.4}'::jsonb,
  distinguishers = 'Searching outward: observation, change and vastness; unlike the Transformer, the journey is about meaning rather than musical motion.'
FROM public.archetypes a WHERE a.id = p.archetype_id AND a.name = 'The Seeker';