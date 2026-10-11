alter table public.choices add column if not exists rejected_song_id uuid references public.songs(id) on delete cascade;

update public.choices c
set rejected_song_id = case
  when p.song_a_id = c.chosen_song_id then p.song_b_id
  else p.song_a_id
end
from public.pairings p
where c.pairing_id = p.id and c.rejected_song_id is null;

create index if not exists choices_rejected_idx on public.choices(rejected_song_id);