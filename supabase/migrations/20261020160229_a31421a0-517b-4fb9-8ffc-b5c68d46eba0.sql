INSERT INTO public.pairings (song_a_id,song_b_id,tests,hypothesis,lane,active,is_bootstrap)
SELECT sa.id,sb.id,p.tests::text[],p.h,'alternative',false,false FROM (VALUES
('Budapest','Solar Power','{tension,perspective}','easy contentment vs. deliberate deflation'),
('Feel It Still','The Adults Are Talking','{movement,confidence}','retro-soul strut vs. legacy-act cool'),
('Not Strong Enough','drivers license','{community,perspective}','confession in harmony vs. heartbreak alone'),
('De Selby (Part 2)','Breezeblocks','{texture,atmosphere}','groove-haze vs. art-school menace'),
('Clearest Blue','Shut Up and Dance','{transformation,movement}','engineered release vs. instant floor-filler'),
('Heat Waves','Such Great Heights','{immersion,atmosphere}','2020 haze vs. 2003 bedroom glow'),
('Solar Power','Float On','{perspective,tension}','two kinds of letting it go'),
('Budapest','Ho Hey','{community,scale}','warm radio-alt vs. stomp-along sincerity'),
('The Adults Are Talking','Do I Wanna Know?','{tension,texture}','wiry restraint vs. slow-burn desire')
) p(a,b,tests,h)
JOIN public.songs sa ON sa.title=p.a AND sa.scoring_version='cat06-draft-1'
JOIN public.songs sb ON sb.title=p.b AND sb.scoring_version='cat06-draft-1'
WHERE NOT EXISTS (SELECT 1 FROM public.pairings x WHERE x.song_a_id=sa.id AND x.song_b_id=sb.id);