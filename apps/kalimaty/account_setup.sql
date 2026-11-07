-- ============================================================
-- الدخول برقم الهاتف + حذف الحساب نهائيًا — شغّله مرة واحدة في Supabase
-- Supabase Dashboard -> SQL Editor -> New query -> الصق -> Run
-- ============================================================

-- 1) كل حسابات الطلاب المرتبطة برقم هاتف (تُستخدم في شاشة الدخول)
--    البريد الداخلي للطالب بالشكل:  <الهاتف>-<رمز>@kalimaty.app
create or replace function public.phone_accounts(p text)
returns table (id uuid, name text, grade int, avatar text, email text)
language sql
security definer
stable
set search_path = public, auth
as $$
  select u.id, coalesce(pr.name, ''), pr.grade, pr.avatar, u.email::text
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where length(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')) between 8 and 15
    and u.email like regexp_replace(p, '[^0-9]', '', 'g') || '-%@kalimaty.app'
  order by pr.name
  limit 10
$$;
grant execute on function public.phone_accounts(text) to anon, authenticated;

-- 2) حذف حساب المستخدم الحالي نهائيًا مع كل بياناته (طالب أو معلم)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthenticated'; end if;
  if to_regclass('public.quiz_results') is not null then
    execute 'delete from public.quiz_results where student_id = $1' using uid;
  end if;
  if to_regclass('public.user_data') is not null then
    execute 'delete from public.user_data where user_id = $1' using uid;
  end if;
  if to_regclass('public.profiles') is not null then
    execute 'delete from public.profiles where id = $1' using uid;
  end if;
  delete from auth.users where id = uid;   -- يحذف اختبارات المعلم تلقائيًا (on delete cascade)
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 3) حسابات المعلمين المرتبطة برقم هاتف (دخول المعلم بالهاتف فقط)
--    البريد الداخلي للمعلم بالشكل:  teacher-<الهاتف>-<رمز>@kalimaty.app
create or replace function public.teacher_accounts(p text)
returns table (id uuid, name text, class_name text, email text)
language sql
security definer
stable
set search_path = public, auth
as $$
  select u.id, coalesce(pr.name, ''), pr.class_name, u.email::text
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  where length(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')) between 8 and 15
    and u.email like 'teacher-' || regexp_replace(p, '[^0-9]', '', 'g') || '-%@kalimaty.app'
  order by pr.name
  limit 5
$$;
grant execute on function public.teacher_accounts(text) to anon, authenticated;
