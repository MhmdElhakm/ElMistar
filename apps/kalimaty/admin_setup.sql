-- ============================================================
-- إعداد صلاحيات صفحة الأدمن (admin.html) — شغّله مرة واحدة في Supabase
-- Supabase Dashboard -> SQL Editor -> New query -> الصق -> Run
-- ============================================================

-- 1) جدول المشرفين
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

-- 2) دالة التحقق من المشرف
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- 3) المشرف يقرأ ويعدّل ويحذف كل بيانات الطلاب
drop policy if exists "admin full access profiles" on public.profiles;
create policy "admin full access profiles" on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin full access user_data" on public.user_data;
create policy "admin full access user_data" on public.user_data
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4) حذف طالب بالكامل (الملف + التقدم + حساب الدخول)
create or replace function public.admin_delete_student(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.user_data where user_id = target;
  delete from public.profiles  where id = target;
  delete from auth.users       where id = target;
end $$;

revoke all on function public.admin_delete_student(uuid) from public;
grant execute on function public.admin_delete_student(uuid) to authenticated;

-- 5) أنشئ مستخدم المشرف أولًا من: Authentication -> Users -> Add user
--    (بريد وكلمة مرور حقيقيين وقويين)، ثم ضع بريده هنا وشغّل السطر:
-- insert into public.admins (user_id) select id from auth.users where email = 'ضع-بريد-المشرف@example.com';
