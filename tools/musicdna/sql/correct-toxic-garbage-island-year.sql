-- Owner-requested metadata correction, 2026-11-19.
-- Official release: The Way of All Flesh, October 13, 2008.
-- https://gojiraofficial.bandcamp.com/album/the-way-of-all-flesh
-- Historical migrations, audit snapshots, choices and saved readings stay untouched.
UPDATE public.songs
SET year = 2008
WHERE id = '2e414e30-7bec-4f2c-b617-39d80855bc7d'
  AND title = 'Toxic Garbage Island'
  AND artist = 'Gojira'
  AND year = 2006
RETURNING id, title, artist, year;