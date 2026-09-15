-- ============================================================
-- ناقصنا إيه | ترقية العائلة المشتركة + RLS آمنة
-- نفّذ هذا الملف في Supabase Dashboard ← SQL Editor (بعد ملف السكيما الأساسي)
-- المتطلب المسبق في الداشبورد: Authentication ← Providers ← تفعيل Anonymous sign-ins
-- التصميم: family_id للعائلة = كود البيت (HOME-XXXX) المشترك بين الزوجين
-- orders تحمل family/home code + created_by (صاحب الإنشاء محفوظ)
-- ============================================================

-- 1) جدول العضوية: يربط كل جهاز (مستخدم مجهول) بكود بيته
create table if not exists members (
  device_uid uuid not null,
  home_code text not null,
  name text not null default '',
  role text not null default '',
  created_at timestamptz not null default now(),
  primary key (device_uid, home_code)
);
create index if not exists members_home_idx on members (home_code);
alter table members enable row level security;

drop policy if exists m_sel on members;
drop policy if exists m_ins on members;
drop policy if exists m_upd on members;
-- العضو يرى صفوف عضويته فقط (المستخدمين المجهولين بيدخلوا بـ authenticated role)
create policy m_sel on members for select to authenticated using (device_uid = auth.uid());
-- أي جهاز مسجل مجهول يسجل عضويته بنفسه فقط
create policy m_ins on members for insert to authenticated with check (device_uid = auth.uid());
-- يحدّث بياناته فقط
create policy m_upd on members for update to authenticated
  using (device_uid = auth.uid()) with check (device_uid = auth.uid());

-- 2) إسقاط السياسات المفتوحة القديمة على جداول العائلة
drop policy if exists anon_all on homes;
drop policy if exists anon_all on orders;
drop policy if exists anon_all on users;

-- 3) سياسات العائلة: العضو يرى/يعدل فقط صفوف كود بيته
drop policy if exists fam_sel on homes;
drop policy if exists fam_ins on homes;
drop policy if exists fam_upd on homes;
create policy fam_sel on homes for select to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code));
-- إنشاء بيت جديد مسموح (الكود عشوائي) ثم تُسجَّل العضوية فورًا
create policy fam_ins on homes for insert to authenticated with check (true);
create policy fam_upd on homes for update to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = homes.code));

drop policy if exists fam_all on orders;
create policy fam_all on orders for all to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = orders.home_code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = orders.home_code));

drop policy if exists fam_all on users;
create policy fam_all on users for all to authenticated
  using (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = users.home_code))
  with check (exists (select 1 from members m where m.device_uid = auth.uid() and m.home_code = users.home_code));

-- ملاحظة: جداول المحتوى العام (comedy_messages / audio_items / ads)
-- تبقى بسياسة anon_all المفتوحة عمدًا — محتوى عام مشترك لكل العائلات.

-- 4) دوال آمنة (SECURITY DEFINER) للانضمام وتأكيد العضوية
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

-- 5) التحديث اللحظي لجدول الطلبات أيضًا (اختياري لكن موصى به)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end $$;
