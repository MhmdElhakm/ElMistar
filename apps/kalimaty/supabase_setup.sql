-- Kalimaty: tables + security (run once in Supabase > SQL Editor)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  grade int check (grade between 1 and 12),
  xp int not null default 0 check (xp >= 0),
  streak int not null default 0 check (streak >= 0),
  avatar text check (avatar is null or char_length(avatar) < 200000),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (octet_length(state::text) < 3000000),
  updated_at timestamptz not null default now()
);

alter table public.profiles  enable row level security;
alter table public.user_data enable row level security;

-- leaderboard: any signed-in student can read names / xp (no phone or email stored here)
create policy "profiles: signed-in can read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- private progress: only the owner
create policy "user_data: read own" on public.user_data
  for select to authenticated using (auth.uid() = user_id);
create policy "user_data: insert own" on public.user_data
  for insert to authenticated with check (auth.uid() = user_id);
create policy "user_data: update own" on public.user_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_data: delete own" on public.user_data
  for delete to authenticated using (auth.uid() = user_id);

-- explicit grants (new tables are not auto-exposed)
revoke all on public.profiles, public.user_data from anon;
grant select, insert, update on public.profiles  to authenticated;
grant select, insert, update, delete on public.user_data to authenticated;
