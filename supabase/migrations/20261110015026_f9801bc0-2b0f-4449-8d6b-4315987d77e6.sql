UPDATE public.pairings p SET tests = v.t, updated_at = now() FROM (VALUES
('4680d087-0ad4-4178-a0d1-31930dc2237f'::uuid, ARRAY['community','transformation']::text[]),
('bd4f2c1d-ad55-4c08-8616-c2962a92fa46'::uuid, ARRAY['atmosphere']::text[]),
('b056d3ae-a00b-443c-8390-68411d0d9d0d'::uuid, ARRAY['movement','scale','confidence']::text[]),
('d25b7270-206f-46b4-ad45-23e605f45692'::uuid, ARRAY['transformation','atmosphere']::text[]),
('21e032f8-ecc5-4c48-9f54-846a9a348ea1'::uuid, ARRAY['transformation']::text[]),
('49a716d0-1ca3-47ed-8529-75524ef11c39'::uuid, ARRAY['atmosphere','texture','immersion']::text[]),
('8cc9f7ad-4972-48ff-910f-e7f8211b37dd'::uuid, ARRAY['immersion','transformation','atmosphere']::text[]),
('54f701be-00e6-4add-8c56-358f840515e7'::uuid, ARRAY['transformation']::text[]),
('256a1d36-e70a-4687-bd00-7ed28a2b373d'::uuid, ARRAY['atmosphere']::text[])
) AS v(id, t) WHERE p.id = v.id;