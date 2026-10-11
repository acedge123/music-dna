
create type public.app_role as enum ('admin', 'user');

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- user_roles FIRST so has_role can reference it
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- profiles
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  opening_songs jsonb,
  opening_hypothesis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles owner all" on public.profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

-- songs
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  year int,
  lane text not null,
  movement int not null default 50 check (movement between 0 and 100),
  atmosphere int not null default 50 check (atmosphere between 0 and 100),
  groove int not null default 50 check (groove between 0 and 100),
  darkness int not null default 50 check (darkness between 0 and 100),
  hope int not null default 50 check (hope between 0 and 100),
  nostalgia int not null default 50 check (nostalgia between 0 and 100),
  transformation int not null default 50 check (transformation between 0 and 100),
  complexity int not null default 50 check (complexity between 0 and 100),
  melody int not null default 50 check (melody between 0 and 100),
  verbal_cleverness int not null default 50 check (verbal_cleverness between 0 and 100),
  authenticity int not null default 50 check (authenticity between 0 and 100),
  romanticism int not null default 50 check (romanticism between 0 and 100),
  energy int not null default 50 check (energy between 0 and 100),
  dreaminess int not null default 50 check (dreaminess between 0 and 100),
  community int not null default 50 check (community between 0 and 100),
  diagnostic_power int not null default 50 check (diagnostic_power between 0 and 100),
  primary_dimensions text[] not null default '{}',
  archetype_signals text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.songs to authenticated;
grant all on public.songs to service_role;
alter table public.songs enable row level security;
create policy "songs read auth" on public.songs for select to authenticated using (true);
create policy "songs admin write" on public.songs for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger songs_updated_at before update on public.songs for each row execute function public.update_updated_at_column();
create index songs_lane_idx on public.songs(lane) where active;
create index songs_diag_idx on public.songs(diagnostic_power desc) where active;

-- pairings
create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  song_a_id uuid not null references public.songs(id) on delete cascade,
  song_b_id uuid not null references public.songs(id) on delete cascade,
  tests text[] not null default '{}',
  hypothesis text,
  why_good text,
  diagnostic_weight int not null default 50 check (diagnostic_weight between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (song_a_id <> song_b_id)
);
grant select on public.pairings to authenticated;
grant all on public.pairings to service_role;
alter table public.pairings enable row level security;
create policy "pairings read auth" on public.pairings for select to authenticated using (true);
create policy "pairings admin write" on public.pairings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger pairings_updated_at before update on public.pairings for each row execute function public.update_updated_at_column();
create index pairings_weight_idx on public.pairings(diagnostic_weight desc) where active;

-- archetypes
create table public.archetypes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tagline text,
  description text,
  signature_axes jsonb not null default '{}',
  signature_signals text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.archetypes to authenticated;
grant all on public.archetypes to service_role;
alter table public.archetypes enable row level security;
create policy "archetypes read auth" on public.archetypes for select to authenticated using (true);
create policy "archetypes admin write" on public.archetypes for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger archetypes_updated_at before update on public.archetypes for each row execute function public.update_updated_at_column();

-- sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  archetype_id uuid references public.archetypes(id) on delete set null,
  vector jsonb not null default '{}',
  interpretation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.sessions to authenticated;
grant all on public.sessions to service_role;
alter table public.sessions enable row level security;
create policy "sessions owner all" on public.sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger sessions_updated_at before update on public.sessions for each row execute function public.update_updated_at_column();
create index sessions_user_idx on public.sessions(user_id, started_at desc);

-- choices
create table public.choices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  pairing_id uuid not null references public.pairings(id) on delete cascade,
  chosen_song_id uuid not null references public.songs(id) on delete cascade,
  ms_to_decide int,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.choices to authenticated;
grant all on public.choices to service_role;
alter table public.choices enable row level security;
create policy "choices owner all" on public.choices for all to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));
create index choices_session_idx on public.choices(session_id);

-- signup trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
