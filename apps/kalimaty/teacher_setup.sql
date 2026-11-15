-- Teacher accounts and class membership for Kalimaty.
-- Run this script in the Supabase SQL Editor before using teacher registration.
-- In Supabase Auth, enable Email signups and turn off Confirm email.
-- Teacher accounts use an internal generated email; no real email is needed.

alter table public.profiles
  add column if not exists role text,
  add column if not exists class_code text,
  add column if not exists class_name text;

update public.profiles set role = 'student' where role is null;
alter table public.profiles alter column role set default 'student';
alter table public.profiles alter column role set not null;

create unique index if not exists profiles_teacher_class_code_uidx
  on public.profiles (class_code)
  where role = 'teacher' and class_code is not null;
create index if not exists profiles_class_code_role_idx
  on public.profiles (class_code, role);

create or replace function public.guard_profile_class_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.role := 'student';
      new.class_code := null;
      new.class_name := null;
    elsif new.role is distinct from old.role
       or new.class_code is distinct from old.class_code
       or new.class_name is distinct from old.class_name then
      raise exception 'managed_profile_fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_class_fields on public.profiles;
create trigger guard_profile_class_fields
  before insert or update on public.profiles
  for each row execute function public.guard_profile_class_fields();

create or replace function public.teacher_can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles teacher
    join public.profiles student
      on student.class_code = teacher.class_code
    where teacher.id = auth.uid()
      and teacher.role = 'teacher'
      and student.id = p_student_id
      and student.role = 'student'
      and teacher.class_code is not null
  );
$$;

drop function if exists public.teacher_accounts(text);

create or replace function public.teacher_create_profile(p_name text, p_class_name text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_code text;
  v_attempt integer;
  v_has_profile boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_uid
  for update;
  v_has_profile := found;

  if v_has_profile and v_profile.role = 'teacher' then
    return jsonb_build_object(
      'name', v_profile.name,
      'role', v_profile.role,
      'class_code', v_profile.class_code,
      'class_name', v_profile.class_name
    );
  end if;

  if v_has_profile and (v_profile.role <> 'student' or v_profile.class_code is not null) then
    raise exception 'profile_not_available_for_teacher';
  end if;

  for v_attempt in 1..20 loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      if v_has_profile then
        update public.profiles
        set name = left(trim(p_name), 40),
            role = 'teacher',
            class_code = v_code,
            class_name = nullif(left(trim(coalesce(p_class_name, '')), 40), ''),
            updated_at = now()
        where id = v_uid
        returning * into v_profile;
      else
        insert into public.profiles (id, name, role, class_code, class_name, updated_at)
        values (
          v_uid,
          left(trim(p_name), 40),
          'teacher',
          v_code,
          nullif(left(trim(coalesce(p_class_name, '')), 40), ''),
          now()
        )
        returning * into v_profile;
      end if;

      return jsonb_build_object(
        'name', v_profile.name,
        'role', v_profile.role,
        'class_code', v_profile.class_code,
        'class_name', v_profile.class_name
      );
    exception when unique_violation then
      v_code := null;
    end;
  end loop;

  raise exception 'class_code_generation_failed';
end;
$$;

drop function if exists public.check_class_code(text);
create function public.check_class_code(code text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select jsonb_build_object(
    'teacher', profile.name,
    'class_name', profile.class_name,
    'class_code', profile.class_code
  )
  from public.profiles profile
  where profile.role = 'teacher'
    and profile.class_code = upper(trim(coalesce(code, '')))
  limit 1;
$$;

drop function if exists public.join_class(text);
drop function if exists public.my_class();
create function public.my_class()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select jsonb_build_object(
    'teacher', teacher.name,
    'class_name', teacher.class_name,
    'class_code', teacher.class_code
  )
  from public.profiles student
  join public.profiles teacher
    on teacher.class_code = student.class_code
   and teacher.role = 'teacher'
  where student.id = auth.uid()
    and student.role = 'student'
  limit 1;
$$;

create function public.join_class(code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
declare
  v_code text := upper(trim(coalesce(code, '')));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.profiles
    where role = 'teacher' and class_code = v_code
  ) then
    raise exception 'invalid_code';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  ) then
    raise exception 'no_profile';
  end if;
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and class_code is not null
  ) then
    raise exception 'already_joined';
  end if;

  update public.profiles
  set class_code = v_code, updated_at = now()
  where id = auth.uid() and role = 'student';

  return public.my_class();
end;
$$;

drop function if exists public.leave_class();
create function public.leave_class()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles
  set class_code = null, class_name = null, updated_at = now()
  where id = auth.uid() and role = 'student';
  return found;
end;
$$;

drop function if exists public.teacher_remove_student(uuid);
create function public.teacher_remove_student(target uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
declare
  v_code text;
begin
  select class_code into v_code
  from public.profiles
  where id = auth.uid() and role = 'teacher';

  if v_code is null then
    raise exception 'not_teacher';
  end if;

  update public.profiles
  set class_code = null, class_name = null, updated_at = now()
  where id = target and role = 'student' and class_code = v_code;
  return found;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_teacher_read_class on public.profiles;
create policy profiles_teacher_read_class on public.profiles
  for select to authenticated
  using (role = 'student' and public.teacher_can_view_student(id));

drop policy if exists user_data_select_self on public.user_data;
create policy user_data_select_self on public.user_data
  for select to authenticated using (user_id = auth.uid());
drop policy if exists user_data_insert_self on public.user_data;
create policy user_data_insert_self on public.user_data
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_data_update_self on public.user_data;
create policy user_data_update_self on public.user_data
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_data_teacher_read_class on public.user_data;
create policy user_data_teacher_read_class on public.user_data
  for select to authenticated
  using (public.teacher_can_view_student(user_id));

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_data to authenticated;

revoke all on function public.teacher_can_view_student(uuid) from public;
revoke all on function public.teacher_create_profile(text, text) from public;
revoke all on function public.check_class_code(text) from public;
revoke all on function public.my_class() from public;
revoke all on function public.join_class(text) from public;
revoke all on function public.leave_class() from public;
revoke all on function public.teacher_remove_student(uuid) from public;

grant execute on function public.teacher_can_view_student(uuid) to authenticated;
grant execute on function public.teacher_create_profile(text, text) to authenticated;
grant execute on function public.check_class_code(text) to anon, authenticated;
grant execute on function public.my_class() to authenticated;
grant execute on function public.join_class(text) to authenticated;
grant execute on function public.leave_class() to authenticated;
grant execute on function public.teacher_remove_student(uuid) to authenticated;
