import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('corrects Gojira’s Toxic Garbage Island to 2008 without changing scores or frozen evidence', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.songs (id uuid PRIMARY KEY, title text, artist text, year integer, tension integer, active boolean);
      CREATE TABLE public.choices (evidence jsonb);
      INSERT INTO public.songs VALUES
        ('2e414e30-7bec-4f2c-b617-39d80855bc7d', 'Toxic Garbage Island', 'Gojira', 2006, 90, true),
        ('00000000-0000-4000-8000-000000000001', 'Other Song', 'Gojira', 2006, 50, false);
      INSERT INTO public.choices VALUES ('{"year":2006,"tension":90}');
    `);
    const sql = readFileSync(new URL('./sql/correct-toxic-garbage-island-year.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const songs = await db.query('SELECT title, year, tension, active FROM public.songs ORDER BY title');
    expect(songs.rows).toEqual([
      { title: 'Other Song', year: 2006, tension: 50, active: false },
      { title: 'Toxic Garbage Island', year: 2008, tension: 90, active: true },
    ]);
    const choices = await db.query('SELECT evidence FROM public.choices');
    expect(choices.rows).toEqual([{ evidence: { year: 2006, tension: 90 } }]);
  } finally {
    await db.close();
  }
});