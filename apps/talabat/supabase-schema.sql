-- ============================================================
-- ناقصنا إيه | Supabase schema
-- نفّذ هذا الملف مرة واحدة في Supabase Dashboard ← SQL Editor
-- (Project: xivdqenmikhljdlmpsfc — Europe)
-- ============================================================

-- 1) الجداول (jsonb مرن حتى لا نحتاج تعديل السكيما مع تطور التطبيق)
create table if not exists homes (
  code text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0
);

create table if not exists orders (
  id text primary key,
  home_code text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  home_code text not null default '',
  data jsonb not null default '{}'::jsonb
);

create table if not exists comedy_messages (
  id text primary key,
  data jsonb not null default '{}'::jsonb
);

create table if not exists audio_items (
  id text primary key,
  data jsonb not null default '{}'::jsonb
);

create table if not exists ads (
  id text primary key,
  data jsonb not null default '{}'::jsonb
);

-- 2) فهارس للبحث السريع
create index if not exists orders_home_idx on orders (home_code);
create index if not exists users_home_idx on users (home_code);

-- 3) تفعيل RLS + صلاحيات anon (التطبيق بدون تسجيل دخول —
-- الأمان هنا بكود البيت العشوائي HOME-XXXX مثل ما كان في Firebase)
alter table homes enable row level security;
alter table orders enable row level security;
alter table users enable row level security;
alter table comedy_messages enable row level security;
alter table audio_items enable row level security;
alter table ads enable row level security;

drop policy if exists anon_all on homes;
drop policy if exists anon_all on orders;
drop policy if exists anon_all on users;
drop policy if exists anon_all on comedy_messages;
drop policy if exists anon_all on audio_items;
drop policy if exists anon_all on ads;

create policy anon_all on homes for all to anon using (true) with check (true);
create policy anon_all on orders for all to anon using (true) with check (true);
create policy anon_all on users for all to anon using (true) with check (true);
create policy anon_all on comedy_messages for all to anon using (true) with check (true);
create policy anon_all on audio_items for all to anon using (true) with check (true);
create policy anon_all on ads for all to anon using (true) with check (true);

-- 4) التحديث اللحظي لجدول البيوت (مزامنة الزوجين لحظة بلحظة)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'homes'
  ) then
    alter publication supabase_realtime add table homes;
  end if;
end $$;
