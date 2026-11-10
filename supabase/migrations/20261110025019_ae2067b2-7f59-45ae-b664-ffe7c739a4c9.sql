BEGIN;
WITH v(id,title,artist,year,mov,atm,tra,com,imm,sca,per,con,ten,tex,pol,rich,den,ident,long,crossmap,why) AS (VALUES
('6c999d3c-90b8-4368-9286-1999e0232e4e','Fight the Power','Public Enemy',1989,88,25,30,92,25,85,90,95,90,28,18,18,14,15,14,8,'Massed voices and abrasive samples turn protest into a public rally.'),
('e7c363ed-78e7-4e57-a80f-829fc96055d6','It Was a Good Day','Ice Cube',1992,60,65,15,40,45,30,85,65,12,70,15,17,13,14,14,8,'An unhurried neighborhood diary finds relief in an ordinary day without violence.'),
('1670ab5a-270d-45cc-9ff5-dec5bd6b0bd6','Paid in Full','Eric B. & Rakim',1987,72,40,15,45,30,35,35,88,30,40,14,15,13,14,14,8,'Sparse breakbeat and cool, economical self-possession; control without spectacle.'),
('a382bf4f-b634-4a62-af2c-ce46ec28bf4f','Mind Playing Tricks on Me','Geto Boys',1991,55,88,35,15,70,30,55,28,92,42,18,19,14,14,13,7,'Three street narratives turn inward as paranoia cracks the tough exterior.'),
('753f9d00-2904-4585-b2a1-a38b6c623cc7','Respiration','Black Star feat. Common',1998,45,90,40,25,85,55,95,58,62,65,17,19,14,14,13,7,'Layered city portraits unfold slowly over a nocturnal jazz-soul beat.'),
('8db875f4-a843-42a6-9087-abb8d834a983','You Got Me','The Roots feat. Erykah Badu & Eve',1999,48,75,65,30,65,32,30,38,42,82,16,18,14,13,13,9,'A relationship negotiation on live drums, breaking into a restless drum-and-bass coda.'),
('67897b6c-e712-446e-87e8-4c43916a39cb','Ms. Fat Booty','Mos Def',1999,65,55,40,30,55,30,80,62,48,65,16,18,13,14,13,8,'A conversational romantic story whose confident beginning gives way to disappointment.'),
('7489524d-8374-46da-ad13-859a354c03d7','U.N.I.T.Y.','Queen Latifah',1993,62,40,25,80,30,48,90,92,70,68,17,18,14,15,14,8,'A firm public demand for respect with a warm jazz loop and a collective hook.'),
('bc62d8cc-0a35-4d47-8411-729bfbef64d7','Ruffneck','MC Lyte',1993,85,30,15,72,18,45,20,95,68,30,16,17,12,14,13,7,'A blunt, percussive statement of desire delivered with punchy command.'),
('102b2a24-4900-4b44-87a5-718aa323e69a','Push It','Salt-N-Pepa',1987,95,20,10,95,10,65,15,90,15,65,16,17,14,15,14,9,'Bright synths and a crowd-ready chant make bodily momentum the whole event.'),
('4fc22bac-4440-42d7-ad3e-c23902b5ccb4','Get Ur Freak On','Missy Elliott',2001,92,70,35,82,35,65,20,92,45,78,18,19,14,15,14,10,'Elastic percussion, space and a bhangra hook make swagger feel playfully alien.'),
('55b6ba01-2877-4001-8946-76ee895fc02c','B.O.B. (Bombs Over Baghdad)','Outkast',2000,98,45,82,75,55,95,60,90,88,72,18,19,14,15,14,10,'Double-time rap explodes through guitars, gospel voices and drum-and-bass propulsion.'),
('34bd4299-e3a9-4a99-b362-7fa3e0623932','Int''l Players Anthem (I Choose You)','UGK feat. Outkast',2007,62,50,68,82,55,65,45,78,25,80,17,18,14,15,13,9,'An unaccompanied wedding verse opens into a triumphant soul-sample celebration.'),
('22bbe552-1792-4bcd-a9d6-cac318c43b7d','Grindin''','Clipse',2002,78,25,10,60,15,35,65,94,72,15,18,18,14,15,14,7,'Bare knuckle percussion and clipped street detail; hard edges with almost no ornament.'),
('6ea8230a-6be1-4e26-ad0d-3be0c9169d2d','Dreams and Nightmares','Meek Mill',2012,82,40,95,92,60,88,40,90,90,48,18,19,14,15,12,8,'Piano-led reflection suddenly becomes a shouted, full-throttle victory charge.'),
('71432da7-c338-42f2-b860-3fa897251d7e','Love Yourz','J. Cole',2014,30,70,20,45,65,25,30,35,25,65,17,19,14,14,12,8,'A restrained piano-and-soul meditation on insecurity, gratitude and enough.'),
('b506c2b8-ed06-4b3c-a9fd-98415a994eed','4:44','Jay-Z',2017,35,78,25,15,75,25,15,25,60,58,18,19,14,15,12,7,'A spare, looping apology abandons the mogul pose for uncomfortable confession.'),
('9c391cbc-2e76-424b-97ba-ea41e5187c1a','DNA.','Kendrick Lamar',2017,92,30,78,58,28,75,30,96,95,42,18,19,14,15,13,8,'An aggressive identity claim switches beats and escalates into a breathless attack.'),
('01646d38-adf7-4042-9951-71a03640f01d','Introvert','Little Simz',2021,58,82,92,55,90,98,55,62,72,95,18,19,14,15,11,9,'Private doubt wrestles with public responsibility inside an orchestral, multi-section epic.'),
('a230fa16-1069-4f62-924a-c02d7e34b4df','Anxiety','Doechii',2025,65,78,35,58,42,40,15,32,85,72,17,18,14,14,6,9,'An anxious inner monologue rides a familiar, bright sample rather than hiding its unease.')
)
INSERT INTO public.songs (id,title,artist,year,lane,primary_lane,movement,atmosphere,transformation,community,immersion,scale,perspective,confidence,tension,texture,polarization,tradeoff_richness,pairing_density,identity_signaling,longevity,cross_genre_mapping,diagnostic_power,rationale,active,scoring_version,scoring_provenance,scored_at,primary_dimensions)
SELECT id::uuid,title,artist,year,'hip_hop','hip_hop',mov,atm,tra,com,imm,sca,per,con,ten,tex,pol,rich,den,ident,round(long*10.0/15)::integer,crossmap,pol+rich+den+ident+round(long*10.0/15)::integer+crossmap,why,false,'hip_hop_expansion_2026_11_10','{"method":"independent_editorial","review":"pending","predictive_validation":false}'::jsonb,now(),ARRAY(SELECT k FROM (VALUES ('movement',mov),('atmosphere',atm),('transformation',tra),('community',com),('immersion',imm),('scale',sca),('perspective',per),('confidence',con),('tension',ten),('texture',tex)) t(k,x) ORDER BY abs(x-50) DESC,k LIMIT 3) FROM v;
WITH pr(a,b,tests,saying) AS (VALUES
('Fight the Power','It Was a Good Day',ARRAY['tension','community','atmosphere'],'Mobilize the block, or savor one day when nothing goes wrong?'),
('Paid in Full','Mind Playing Tricks on Me',ARRAY['confidence','tension'],'Keep the delivery ice-cool, or let paranoia crack the armor?'),
('Respiration','Push It',ARRAY['immersion','perspective'],'Read the city after midnight, or answer the dance-floor chant?'),
('You Got Me','Grindin''',ARRAY['texture','transformation'],'Live drums that break open, or a beat stripped to bare knuckles?'),
('Ms. Fat Booty','4:44',ARRAY['perspective','confidence'],'Tell the romantic misadventure, or own the damage in an apology?'),
('U.N.I.T.Y.','Anxiety',ARRAY['confidence','perspective'],'Demand respect in public, or confess the noise inside your head?'),
('Ruffneck','Love Yourz',ARRAY['movement','confidence'],'State your desire without blinking, or quietly learn what enough means?'),
('Get Ur Freak On','Respiration',ARRAY['movement','community'],'Bounce through Missy''s alien playground, or walk Black Star''s night streets?'),
('B.O.B. (Bombs Over Baghdad)','Paid in Full',ARRAY['scale','transformation','atmosphere'],'Let the gospel-and-guitar sprint explode, or hold Rakim''s measured line?'),
('Int''l Players Anthem (I Choose You)','Mind Playing Tricks on Me',ARRAY['community','tension'],'Toast the wedding over soul horns, or check the shadows for danger?'),
('Dreams and Nightmares','You Got Me',ARRAY['tension','community'],'Turn the victory speech into a roar, or negotiate trust over live drums?'),
('DNA.','Introvert',ARRAY['immersion','texture'],'Attack in two hard bursts, or unfold doubt as an orchestral epic?'),
('Fight the Power','4:44',ARRAY['confidence','community'],'Lead the protest chorus, or drop the mogul mask alone?'),
('It Was a Good Day','DNA.',ARRAY['tension','movement'],'Cruise through a peaceful afternoon, or push the engine into the red?'),
('Paid in Full','Introvert',ARRAY['scale','texture'],'A spare breakbeat and precision, or brass, strings and a whole inner world?'),
('Mind Playing Tricks on Me','Push It',ARRAY['tension','community','atmosphere'],'Sit with street-born paranoia, or shake it off with a roomful of voices?'),
('Respiration','Ruffneck',ARRAY['perspective','immersion'],'Study the city in long verses, or deliver desire in sharp jabs?'),
('You Got Me','B.O.B. (Bombs Over Baghdad)',ARRAY['scale','movement'],'Stay close to a fragile relationship, or sprint into a gospel-sized blast?'),
('Ms. Fat Booty','U.N.I.T.Y.',ARRAY['community','confidence'],'Follow a courtship gone sideways, or join a demand for respect?'),
('Get Ur Freak On','4:44',ARRAY['confidence','community'],'Make mischief with the whole room, or make an apology without an audience?'),
('Int''l Players Anthem (I Choose You)','Grindin''',ARRAY['texture','transformation'],'Open the wedding into a soul celebration, or keep the grind spare and hard?'),
('Dreams and Nightmares','Love Yourz',ARRAY['transformation','tension'],'Flip reflection into a victory charge, or stay with the lesson of enough?'),
('Introvert','Anxiety',ARRAY['scale','immersion'],'Build an orchestral monument to doubt, or loop the anxious thought close up?'),
('DNA.','U.N.I.T.Y.',ARRAY['transformation','texture'],'Switch the beat and intensify the attack, or hold firm over a warm jazz loop?')
)
INSERT INTO public.pairings (song_a_id,song_b_id,tests,lane,active,user_facing_tradeoff,diagnostic_weight,hypothesis,why_good)
SELECT a.id,b.id,pr.tests,'hip_hop',false,pr.saying,80,'Within-lane contrast on '||array_to_string(pr.tests,', ')||'.',pr.saying FROM pr JOIN public.songs a ON a.title=pr.a AND a.scoring_version='hip_hop_expansion_2026_11_10' JOIN public.songs b ON b.title=pr.b AND b.scoring_version='hip_hop_expansion_2026_11_10';
COMMIT;