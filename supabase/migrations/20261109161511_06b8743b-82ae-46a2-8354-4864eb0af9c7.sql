BEGIN;
LOCK TABLE public.songs IN SHARE MODE;
LOCK TABLE public.pairings IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE coverage_batch(id uuid,a uuid,b uuid,tests text[],av int[],bv int[],hypothesis text) ON COMMIT DROP;
INSERT INTO coverage_batch VALUES
('a58e5b54-6291-5283-a79b-cd4a3da7b33d','78f9fbe3-8022-4b0b-abf8-e98f979975d8','f6e875f0-9820-4c87-95ca-0a26dfec5ee5',ARRAY['immersion','tension'],ARRAY[85,75],ARRAY[5,12],'A slow, uneasy spiral versus a quick burst of carefree pop'),
('7a48dcce-e496-56ba-a808-c7b882b06647','706cc200-c760-42a9-9268-57babc11bbb6','8dd546e1-86b3-42c3-b72d-eed10b697958',ARRAY['immersion','scale'],ARRAY[5,20],ARRAY[80,95],'Clipped small-room attack versus sprawling anthem'),
('b594c456-ef48-5c1e-be44-3a45671e497e','1137b9e1-bfba-4c08-b5b8-a66eff717397','6a06b74f-7161-492e-b492-6f2fa0c468d8',ARRAY['tension'],ARRAY[85],ARRAY[18],'Feverish unease versus easygoing release'),
('2d1239a2-4905-5933-9c49-bb1fe2ba5ff6','5406735f-3b9e-484a-91b2-f67c7a6550ab','5a849655-bd3d-402a-9547-34fbaae4837c',ARRAY['tension'],ARRAY[95],ARRAY[35],'Threatening accumulation versus soft release'),
('b5da650d-56c8-54f0-bb6c-4e45bdd23865','6974a705-aa3d-4544-915c-074248964c83','0a41917b-7f35-4140-b4c1-678ac0508e60',ARRAY['tension'],ARRAY[85],ARRAY[20],'Exposed distress versus reassuring shelter'),
('7331095e-1a02-52e6-9f68-832d1f5a8d53','b9bb7f17-eada-42a4-aa56-fb5be435f84b','02f9adaf-d9c4-4b01-8ba4-83dd0936e0d0',ARRAY['immersion'],ARRAY[85],ARRAY[20],'Extended unfolding trance versus immediate groove'),
('3b2fa5c0-bd6d-5f39-8fff-424a0a54c719','330a0505-892f-4742-96fe-e332980c0ad5','f7bc8e6c-64bd-448b-8e94-02f225b18966',ARRAY['tension','immersion'],ARRAY[96,78],ARRAY[20,30],'Relentless unresolved testimony versus concise reassurance'),
('7b681231-ed70-5c4e-9031-27563b3f3356','d6c4ba8b-433a-49c2-8e97-3208b3dfc3f2','a593aa7d-fe11-47a8-8f2b-2b812243f63c',ARRAY['scale'],ARRAY[15],ARRAY[100],'Close piano confession versus monumental choral spectacle'),
('642d0ade-9465-533e-a13e-87124b688f51','ed71d549-938b-4f58-9fa6-31493f73d4aa','964748cd-d754-4795-815c-f80f8bb72acf',ARRAY['tension'],ARRAY[71],ARRAY[15],'Dislocated identity versus acoustic repose'),
('b29f440e-8388-53fb-ae72-69f2a800a431','98434303-ddff-4b2b-a761-42c7fdce17a9','9594a00e-cb5d-4f22-ab29-f9d1b039fd9a',ARRAY['immersion'],ARRAY[82],ARRAY[12],'Long dramatic accumulation versus compact immediate impact'),
('c8644381-847b-58c5-8621-09932421ccb6','7b5dd1a4-8cbd-41ef-bf49-ed07c64a3c9f','5a7992e2-3504-44af-ba6d-e15e68b52933',ARRAY['scale'],ARRAY[12],ARRAY[85],'Confined whispered performance versus towering guitar sweep'),
('534f1cf6-fd2f-55ca-8d34-d62cdb928c1b','df00c50a-0f25-4b7a-a3a2-130b796013c8','8be7c656-8b9f-4f49-81e9-f53528e2e582',ARRAY['tension'],ARRAY[84],ARRAY[15],'Inward dread versus wistful ease'),
('1d93ffe4-ec40-5989-894e-64f58326d8bc','834772b4-b107-4aaa-a43c-ec060dce52fe','998c9cd8-8e31-4c2c-8fbe-b6ccbb530419',ARRAY['immersion','tension'],ARRAY[92,81],ARRAY[10,20],'Slow gathering suspense versus immediate release'),
('c4e6ebb2-6d9f-581c-acfe-40a454e1afbd','b1233de7-90f2-4fac-867e-e9759207a2dc','07032102-31ca-44a2-b5dc-cbc40f34ffd2',ARRAY['texture'],ARRAY[95],ARRAY[20],'Glossy electronic air versus ragged band edges'),
('b0fc73e5-5bfc-51b1-a044-15ca26a9eb13','c1a0025e-e530-497f-9741-215bb53a1707','420c9507-d8bd-4fca-84b0-8480d604ccbf',ARRAY['tension'],ARRAY[75],ARRAY[10],'Urgent pleading versus resolved communal lift'),
('32d1b595-2b69-5da2-9075-56fe3787b3cb','6711759b-25f1-4286-9ee6-f25c4d9084c0','3987f7f8-10a1-4645-8fc1-96246455cd50',ARRAY['tension'],ARRAY[88],ARRAY[15],'Frayed disorientation versus settled affection'),
('75f67f4c-34e6-519c-bd4a-3439446aeb61','2b294c6a-e9a8-425e-8234-9343f6d185a0','23feb155-d135-47e7-ab17-b6a6f5c0a869',ARRAY['immersion'],ARRAY[78],ARRAY[15],'Sustained enveloping build versus compact direct hook'),
('f1d61728-b395-5868-a57a-4159a0a6ba41','e0947584-3cde-4d0f-8bec-9c2e0796cb1e','4220564b-c6ff-49fb-ac3a-85602042a264',ARRAY['tension'],ARRAY[85],ARRAY[12],'Nervous compulsion versus uncomplicated delight'),
('cd65c7f4-9dc6-5fa7-b140-f75c29ccd6c7','e2e64168-9ffe-4be6-b57c-d611019dc738','064e248d-8c18-4458-b813-31c3e44fd882',ARRAY['scale','immersion'],ARRAY[95,85],ARRAY[35,20],'Long panoramic guitar arc versus close, direct intimacy'),
('6d5b5396-f0a5-589b-a3c9-5a9abcbd5e3c','00f5a05d-a0dd-4eaa-a8b2-dce75c729f3e','fb3a3279-d429-4c92-abc9-9e97106ff053',ARRAY['tension'],ARRAY[72],ARRAY[25],'Restless guitar pressure versus buoyant floating release'),
('712c8fb1-251b-5b2d-9df3-c32e3109aeb5','91b62cb3-7c27-411a-b08f-d863472b20e3','5811b46c-f3dd-452c-aa7b-9ce9957ea20a',ARRAY['texture'],ARRAY[20],ARRAY[88],'Ragged fuzz surface versus polished chiming pop');
DO $guard$
BEGIN
 IF (SELECT count(*) FROM coverage_batch c JOIN public.songs a ON a.id=c.a JOIN public.songs b ON b.id=c.b WHERE a.active AND b.active AND a.primary_lane='alternative' AND b.primary_lane='alternative' AND a.lane=b.lane AND a.artist<>b.artist AND a.id<>b.id)=21 THEN NULL; ELSE RAISE EXCEPTION 'Song eligibility changed'; END IF;
 IF EXISTS(SELECT 1 FROM coverage_batch c JOIN public.pairings p ON p.song_a_id IN(c.a,c.b) OR p.song_b_id IN(c.a,c.b)) THEN RAISE EXCEPTION 'Target already paired'; END IF;
 IF EXISTS(SELECT 1 FROM coverage_batch c JOIN public.songs sa ON sa.id=c.a JOIN public.songs sb ON sb.id=c.b CROSS JOIN LATERAL generate_subscripts(c.tests,1) ix(n) WHERE c.tests[ix.n] NOT IN('movement','atmosphere','immersion','scale','community','perspective','confidence','tension','texture','transformation') OR (to_jsonb(sa)->>c.tests[ix.n])::int IS DISTINCT FROM c.av[ix.n] OR (to_jsonb(sb)->>c.tests[ix.n])::int IS DISTINCT FROM c.bv[ix.n] OR abs(c.av[ix.n]-c.bv[ix.n])<20) THEN RAISE EXCEPTION 'Reviewed contrast changed: %', (SELECT string_agg(sa.title||' / '||sb.title||' '||c.tests[ix.n]||' actual='||(to_jsonb(sa)->>c.tests[ix.n])||','||(to_jsonb(sb)->>c.tests[ix.n])||' expected='||c.av[ix.n]||','||c.bv[ix.n], '; ') FROM coverage_batch c JOIN public.songs sa ON sa.id=c.a JOIN public.songs sb ON sb.id=c.b CROSS JOIN LATERAL generate_subscripts(c.tests,1) ix(n) WHERE (to_jsonb(sa)->>c.tests[ix.n])::int IS DISTINCT FROM c.av[ix.n] OR (to_jsonb(sb)->>c.tests[ix.n])::int IS DISTINCT FROM c.bv[ix.n]); END IF;
END $guard$;
INSERT INTO public.pairings(id,song_a_id,song_b_id,tests,hypothesis,why_good,user_facing_tradeoff,lane,active,diagnostic_weight,expected_split,difficulty,is_bootstrap)
SELECT id,a,b,tests,hypothesis,hypothesis||'. Same-family, distinct-artist contrast using pinned catalog dimensions. Editorial review only; predictive validity and listener split remain unmeasured.','Which one stays with you?','alternative',true,60,'Unmeasured; listener validation pending',2,false FROM coverage_batch;
COMMIT;