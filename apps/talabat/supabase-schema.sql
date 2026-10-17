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

-- 3) جدول العضوية: يربط كل جهاز بكود بيته (family_id للعائلة = كود البيت)
create table if not exists members (
  device_uid uuid not null,
  home_code text not null,
  name text not null default '',
  role text not null default '',
  created_at timestamptz not null default now(),
  primary key (device_uid, home_code)
);
create index if not exists members_home_idx on members (home_code);

-- 4) تفعيل RLS
alter table homes enable row level security;
alter table orders enable row level security;
alter table users enable row level security;
alter table members enable row level security;
alter table comedy_messages enable row level security;
alter table audio_items enable row level security;
alter table ads enable row level security;

drop policy if exists anon_all on homes;
drop policy if exists anon_all on orders;
drop policy if exists anon_all on users;
drop policy if exists m_sel on members;
drop policy if exists m_ins on members;
drop policy if exists m_upd on members;
drop policy if exists fam_sel on homes;
drop policy if exists fam_ins on homes;
drop policy if exists fam_upd on homes;
drop policy if exists fam_all on orders;
drop policy if exists fam_all on users;
drop policy if exists anon_all on comedy_messages;
drop policy if exists anon_all on audio_items;
drop policy if exists anon_all on ads;

-- العضو يرى/يعدل فقط صفوف كود بيته — لا تسريب بين العائلات
-- (المستخدمين المجهولين بيدخلوا بـ authenticated role)
create policy m_sel on members for select to authenticated using (device_uid = auth.uid());
create policy m_ins on members for insert to authenticated with check (device_uid = auth.uid());
create policy m_upd on members for update to authenticated
  using (device_uid = auth.uid()) with check (device_uid = auth.uid());

create policy fam_sel on homes for select to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code));
create policy fam_ins on homes for insert to authenticated with check (true);
create policy fam_upd on homes for update to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code));

create policy fam_all on orders for all to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = orders.home_code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = orders.home_code));

create policy fam_all on users for all to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = users.home_code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = users.home_code));

-- المحتوى العام مشترك لكل العائلات (نكت/أصوات/إعلانات) — يبقى مفتوحًا عمدًا
create policy anon_all on comedy_messages for all to authenticated using (true) with check (true);
create policy anon_all on audio_items for all to authenticated using (true) with check (true);
create policy anon_all on ads for all to authenticated using (true) with check (true);

-- 5) دوال آمنة للانضمام وتأكيد العضوية
create or replace function public.join_home(p_code text, p_name text default null, p_role text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare h jsonb;
begin
  select data into h from homes where code = p_code;
  if h is null then raise exception 'NO_HOME'; end if;
  insert into members(device_uid, home_code, name, role)
  values (auth.uid(), p_code, coalesce(p_name, ''), coalesce(p_role, ''))
  on conflict (device_uid, home_code)
  do update set
    name = case when excluded.name <> '' then excluded.name else members.name end,
    role = case when excluded.role <> '' then excluded.role else members.role end;
  return h;
end $$;

create or replace function public.ensure_membership(p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from homes where code = p_code) then return; end if;
  insert into members(device_uid, home_code)
  values (auth.uid(), p_code)
  on conflict do nothing;
end $$;

grant execute on function public.join_home(text, text, text) to authenticated;
grant execute on function public.ensure_membership(text) to authenticated;

-- 6) التحديث اللحظي (مزامنة الزوجين لحظة بلحظة)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'homes'
  ) then
    alter publication supabase_realtime add table homes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end $$;
