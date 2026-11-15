-- Teacher-created quizzes and class results for Kalimaty.
-- Run teacher_setup.sql first, then run this script in Supabase SQL Editor.

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_code text not null,
  kind text not null check (kind in ('quiz', 'contest')),
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quizzes_teacher_created_idx
  on public.quizzes (teacher_id, created_at desc);
create index if not exists quizzes_class_status_created_idx
  on public.quizzes (class_code, status, created_at desc);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  score numeric not null default 0,
  max_score numeric not null default 0,
  correct integer not null default 0,
  total integer not null default 0,
  duration_ms bigint not null default 0,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (quiz_id, student_id)
);

create index if not exists quiz_results_quiz_score_idx
  on public.quiz_results (quiz_id, score desc, duration_ms asc);
create index if not exists quiz_results_student_idx
  on public.quiz_results (student_id, created_at desc);

create or replace function public.teacher_owns_class(p_class_code text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'teacher'
      and class_code = p_class_code
  );
$$;

create or replace function public.teacher_owns_quiz(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select exists (
    select 1
    from public.quizzes quiz
    where quiz.id = p_quiz_id
      and quiz.teacher_id = auth.uid()
      and public.teacher_owns_class(quiz.class_code)
  );
$$;

create or replace function public.student_can_take_quiz(p_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
  select exists (
    select 1
    from public.quizzes quiz
    join public.profiles student
      on student.class_code = quiz.class_code
    where quiz.id = p_quiz_id
      and quiz.status = 'published'
      and student.id = auth.uid()
      and student.role = 'student'
  );
$$;

create or replace function public.guard_quiz_result_student()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $$
declare
  v_name text;
begin
  if current_user = 'authenticated' then
    if new.student_id is distinct from auth.uid() then
      raise exception 'result_not_owned';
    end if;
    select name into v_name from public.profiles where id = auth.uid();
    new.student_name := coalesce(v_name, 'طالب');
  end if;
  return new;
end;
$$;

drop trigger if exists guard_quiz_result_student on public.quiz_results;
create trigger guard_quiz_result_student
  before insert or update on public.quiz_results
  for each row execute function public.guard_quiz_result_student();

create or replace function public.quiz_ranking(p_quiz_id uuid)
returns table (
  student_id uuid,
  student_name text,
  score numeric,
  duration_ms bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
begin
  if not public.student_can_take_quiz(p_quiz_id) then
    raise exception 'quiz_not_available';
  end if;

  return query
  select result.student_id, result.student_name, result.score, result.duration_ms
  from public.quiz_results result
  where result.quiz_id = p_quiz_id
  order by result.score desc, result.duration_ms asc nulls last, result.created_at asc
  limit 100;
end;
$$;

alter table public.quizzes enable row level security;
alter table public.quiz_results enable row level security;

drop policy if exists quizzes_teacher_read_own on public.quizzes;
create policy quizzes_teacher_read_own on public.quizzes
  for select to authenticated
  using (teacher_id = auth.uid() and public.teacher_owns_class(class_code));
drop policy if exists quizzes_student_read_published on public.quizzes;
create policy quizzes_student_read_published on public.quizzes
  for select to authenticated
  using (status = 'published' and public.student_can_take_quiz(id));
drop policy if exists quizzes_teacher_insert_own on public.quizzes;
create policy quizzes_teacher_insert_own on public.quizzes
  for insert to authenticated
  with check (teacher_id = auth.uid() and public.teacher_owns_class(class_code));
drop policy if exists quizzes_teacher_update_own on public.quizzes;
create policy quizzes_teacher_update_own on public.quizzes
  for update to authenticated
  using (teacher_id = auth.uid() and public.teacher_owns_class(class_code))
  with check (teacher_id = auth.uid() and public.teacher_owns_class(class_code));
drop policy if exists quizzes_teacher_delete_own on public.quizzes;
create policy quizzes_teacher_delete_own on public.quizzes
  for delete to authenticated
  using (teacher_id = auth.uid() and public.teacher_owns_class(class_code));

drop policy if exists quiz_results_student_read_own on public.quiz_results;
create policy quiz_results_student_read_own on public.quiz_results
  for select to authenticated using (student_id = auth.uid());
drop policy if exists quiz_results_teacher_read_own on public.quiz_results;
create policy quiz_results_teacher_read_own on public.quiz_results
  for select to authenticated using (public.teacher_owns_quiz(quiz_id));
drop policy if exists quiz_results_student_insert_own on public.quiz_results;
create policy quiz_results_student_insert_own on public.quiz_results
  for insert to authenticated
  with check (student_id = auth.uid() and public.student_can_take_quiz(quiz_id));
drop policy if exists quiz_results_student_update_own on public.quiz_results;
create policy quiz_results_student_update_own on public.quiz_results
  for update to authenticated
  using (student_id = auth.uid() and public.student_can_take_quiz(quiz_id))
  with check (student_id = auth.uid() and public.student_can_take_quiz(quiz_id));

grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update on public.quiz_results to authenticated;

revoke all on function public.teacher_owns_class(text) from public;
revoke all on function public.teacher_owns_quiz(uuid) from public;
revoke all on function public.student_can_take_quiz(uuid) from public;
revoke all on function public.quiz_ranking(uuid) from public;
grant execute on function public.teacher_owns_class(text) to authenticated;
grant execute on function public.teacher_owns_quiz(uuid) to authenticated;
grant execute on function public.student_can_take_quiz(uuid) to authenticated;
grant execute on function public.quiz_ranking(uuid) to authenticated;
