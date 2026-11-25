-- Combined Kalimaty setup: teacher, arena, quizzes, and live room modes.
-- Prerequisite: the base schema from live_setup.sql must already be installed; it is not present in this workspace.
-- Run this file in Supabase SQL Editor after installing the prerequisite schema.

-- ===== Teacher accounts and class membership =====
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

-- ===== Arena matches and chat =====
-- ============================================================
-- تحدي الصف الأونلاين: مواجهات حقيقية بين الطلاب (كلمات وجمل)
-- Supabase Dashboard -> SQL Editor -> New query -> الصق -> Run
-- (الجدول profiles موجود مسبقًا من إعداد الحساب)
-- ============================================================
create table if not exists public.arena_presence (
  uid  uuid primary key references auth.users(id) on delete cascade,
  seen timestamptz not null default now()
);

create table if not exists public.arena_matches (
  id         uuid primary key default gen_random_uuid(),
  a          uuid not null references auth.users(id) on delete cascade,
  b          uuid references auth.users(id) on delete cascade,
  kind       text not null default 'mix' check (kind in ('words','sents','mix')),
  lv         text not null default 'e',
  stake      int  not null default 0 check (stake >= 0 and stake <= 1000),
  same_grade boolean not null default false,
  status     text not null default 'waiting' check (status in ('waiting','invited','ready','playing','done','cancelled')),
  qs         jsonb not null,
  n          int  not null,
  t          int  not null,
  a_ready    boolean not null default false,
  b_ready    boolean not null default false,
  a_grade    int,
  b_grade    int,
  ans        jsonb not null default '{}'::jsonb,
  a_score    int  not null default 0,
  b_score    int  not null default 0,
  started_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists arena_matches_q_idx on public.arena_matches (status, kind, lv, stake, created_at);
alter table public.arena_presence enable row level security;
alter table public.arena_matches  enable row level security;   -- بدون سياسات: الوصول عبر الدوال فقط

create or replace function public.ar_uid() returns uuid language plpgsql stable as $$
declare u uuid := auth.uid(); begin if u is null then raise exception 'not_auth'; end if; return u; end $$;

create or replace function public.ar_ping() returns void language plpgsql security definer set search_path=public as $$
begin insert into arena_presence(uid,seen) values (ar_uid(),now()) on conflict (uid) do update set seen=now(); end $$;

create or replace function public.ar_online(p_grade int default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('id',pr.id,'name',pr.name,'grade',pr.grade,
      'avatar',case when length(coalesce(pr.avatar,''))<30000 then pr.avatar end,
      'ago',extract(epoch from now()-p.seen)::int,
      'busy',exists(select 1 from arena_matches m where m.status in ('ready','playing') and (m.a=pr.id or m.b=pr.id))) x
    from arena_presence p join profiles pr on pr.id=p.uid
    where p.seen>now()-interval '7 days' and p.uid<>me
      and (p_grade is null or pr.grade=p_grade)
    order by (p.seen>now()-interval '45 seconds') desc, p.seen desc limit 40) s),'[]'::jsonb);
end $$;

-- إنشاء تحدٍّ: إمّا دعوة لطالب محدد أو طابور عشوائي (ينضم لخصم منتظر إن وُجد)
create or replace function public.ar_open(p_kind text, p_lv text, p_stake int, p_same boolean, p_target uuid, p_qs jsonb, p_n int, p_t int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); mg int; m arena_matches;
begin
  select grade into mg from profiles where id=me;
  update arena_matches set status='cancelled' where a=me and status in ('waiting','invited');
  if p_target is not null then
    if p_target=me then raise exception 'self'; end if;
    insert into arena_matches(a,b,kind,lv,stake,same_grade,status,qs,n,t,a_grade,b_grade)
      values (me,p_target,p_kind,p_lv,p_stake,p_same,'invited',p_qs,p_n,p_t,mg,(select grade from profiles where id=p_target))
      returning * into m;
    return ar_get(m.id);
  end if;
  select * into m from arena_matches
   where status='waiting' and a<>me and kind=p_kind and lv=p_lv and stake=p_stake and created_at>now()-interval '60 seconds'
     and (not (same_grade or p_same) or a_grade is not distinct from mg)
   order by created_at limit 1 for update skip locked;
  if found then
    update arena_matches set b=me,b_grade=mg,status='ready' where id=m.id;
    return ar_get(m.id);
  end if;
  insert into arena_matches(a,kind,lv,stake,same_grade,status,qs,n,t,a_grade)
    values (me,p_kind,p_lv,p_stake,p_same,'waiting',p_qs,p_n,p_t,mg) returning * into m;
  return ar_get(m.id);
end $$;

create or replace function public.ar_get(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); m arena_matches; side text; slot numeric; oppid uuid; opp jsonb; qj jsonb := '[]'::jsonb; q jsonb; i int; mine jsonb; theirs jsonb; ansj jsonb := '{}'::jsonb; endat timestamptz; done boolean;
begin
  select * into m from arena_matches where id=p_id for update;
  if not found or (m.a<>me and m.b is distinct from me) then raise exception 'not_found'; end if;
  -- تنظيف المهلات
  if m.status='waiting' and m.created_at<now()-interval '90 seconds' then update arena_matches set status='cancelled' where id=m.id; m.status:='cancelled'; end if;
  if m.status='invited' and m.created_at<now()-interval '70 seconds' then update arena_matches set status='cancelled' where id=m.id; m.status:='cancelled'; end if;
  if m.status='ready' and m.created_at<now()-interval '150 seconds' and not (m.a_ready and m.b_ready) then update arena_matches set status='cancelled' where id=m.id; m.status:='cancelled'; end if;
  if m.status='playing' then
    endat := m.started_at + (m.n*(m.t+3)+4) * interval '1 second';
    if now()>endat then update arena_matches set status='done' where id=m.id; m.status:='done'; end if;
  end if;
  side := case when m.a=me then 'a' else 'b' end;
  oppid := case when side='a' then m.b else m.a end;
  if oppid is not null then
    select jsonb_build_object('id',pr.id,'name',pr.name,'grade',pr.grade,'avatar',pr.avatar,
       'online',coalesce((select seen>now()-interval '45 seconds' from arena_presence where uid=pr.id),false)) into opp from profiles pr where pr.id=oppid;
  end if;
  done := m.status='done';
  for i in 0..m.n-1 loop
    q := m.qs->i;
    mine := m.ans->(i::text)->side;
    theirs := m.ans->(i::text)->(case when side='a' then 'b' else 'a' end);
    if not (mine is not null or done) then q := q - 'a'; end if;
    qj := qj || jsonb_build_array(q);
    ansj := ansj || jsonb_build_object(i::text, jsonb_build_object('mine',mine,
        'oppAnswered',theirs is not null,
        'opp',case when mine is not null or done then theirs end));
  end loop;
  return jsonb_build_object('id',m.id,'status',m.status,'kind',m.kind,'lv',m.lv,'stake',m.stake,'n',m.n,'t',m.t,
    'side',side,'qs',qj,'ans',ansj,'opp',opp,'a_ready',m.a_ready,'b_ready',m.b_ready,
    'a_score',m.a_score,'b_score',m.b_score,
    'started_in',case when m.started_at is null then null else extract(epoch from (m.started_at-now())) end,
    'same_grade',m.same_grade);
end $$;

create or replace function public.ar_inbox() returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'lv',m.lv,'stake',m.stake,
      'from',jsonb_build_object('id',pr.id,'name',pr.name,'grade',pr.grade,'avatar',case when length(coalesce(pr.avatar,''))<30000 then pr.avatar end)))
    from arena_matches m join profiles pr on pr.id=m.a
    where m.b=me and m.status='invited' and m.created_at>now()-interval '60 seconds'),'[]'::jsonb);
end $$;

create or replace function public.ar_accept(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  update arena_matches set status='ready' where id=p_id and b=me and status='invited' and created_at>now()-interval '70 seconds';
  if not found then raise exception 'expired'; end if;
  return ar_get(p_id);
end $$;

create or replace function public.ar_cancel(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  update arena_matches set status='cancelled' where id=p_id and (a=me or b=me) and status in ('waiting','invited','ready');
end $$;

create or replace function public.ar_ready(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); m arena_matches;
begin
  select * into m from arena_matches where id=p_id and (a=me or b=me) for update;
  if not found then raise exception 'not_found'; end if;
  if m.status='ready' then
    if m.a=me then m.a_ready:=true; else m.b_ready:=true; end if;
    update arena_matches set a_ready=m.a_ready,b_ready=m.b_ready,
      status=case when m.a_ready and m.b_ready then 'playing' else 'ready' end,
      started_at=case when m.a_ready and m.b_ready then now()+interval '4 seconds' else started_at end
    where id=m.id;
  end if;
  return ar_get(p_id);
end $$;

create or replace function public.ar_answer(p_id uuid, p_q int, p_pick int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); m arena_matches; side text; slot timestamptz; el numeric; ok boolean; sc int; cur jsonb;
begin
  select * into m from arena_matches where id=p_id and (a=me or b=me) for update;
  if not found then raise exception 'not_found'; end if;
  if m.status<>'playing' then raise exception 'closed'; end if;
  if p_q<0 or p_q>=m.n then raise exception 'bad_q'; end if;
  side := case when m.a=me then 'a' else 'b' end;
  slot := m.started_at + (p_q*(m.t+3)) * interval '1 second';
  el := extract(epoch from (now()-slot));
  if el < -0.5 or el > m.t+1.5 then raise exception 'late'; end if;
  if (m.ans->(p_q::text)->side) is not null then raise exception 'dup'; end if;
  ok := p_pick = (m.qs->p_q->>'a')::int;
  sc := case when ok then 100 + greatest(0, ceil((m.t - least(greatest(el,0),m.t)) * 5))::int else 0 end;
  cur := coalesce(m.ans->(p_q::text),'{}'::jsonb) || jsonb_build_object(side, jsonb_build_object('p',p_pick,'s',sc));
  update arena_matches set ans = jsonb_set(ans, array[p_q::text], cur, true),
    a_score = a_score + case when side='a' then sc else 0 end,
    b_score = b_score + case when side='b' then sc else 0 end
  where id=m.id;
  return jsonb_build_object('ok',ok,'score',sc,'a',(m.qs->p_q->>'a')::int);
end $$;

grant execute on function public.ar_ping(), public.ar_online(int), public.ar_open(text,text,int,boolean,uuid,jsonb,int,int),
  public.ar_get(uuid), public.ar_inbox(), public.ar_accept(uuid), public.ar_cancel(uuid), public.ar_ready(uuid), public.ar_answer(uuid,int,int) to authenticated;

-- ===== دردشة وملصقات داخل المباراة =====
create table if not exists public.arena_chat (
  id bigserial primary key,
  match_id uuid not null references public.arena_matches(id) on delete cascade,
  uid uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists arena_chat_m on public.arena_chat(match_id, id);
alter table public.arena_chat enable row level security;

create or replace function public.ar_say(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid(); b text := left(btrim(coalesce(p_body,'')),140);
begin
  if b = '' then return; end if;
  if not exists(select 1 from arena_matches m where m.id=p_id and (m.a=me or m.b=me)) then raise exception 'not_found'; end if;
  if exists(select 1 from arena_chat c where c.match_id=p_id and c.uid=me and c.created_at>now()-interval '600 milliseconds') then return; end if;
  insert into arena_chat(match_id,uid,body) values (p_id,me,b);
end $$;

create or replace function public.ar_chat(p_id uuid, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid := ar_uid();
begin
  if not exists(select 1 from arena_matches m where m.id=p_id and (m.a=me or m.b=me)) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'mine',c.uid=me,'body',c.body) order by c.id)
    from (select * from arena_chat where match_id=p_id and id>p_after order by id limit 50) c),'[]'::jsonb);
end $$;
grant execute on function public.ar_say(uuid,text), public.ar_chat(uuid,bigint) to authenticated;

-- ===== Quizzes and results =====
-- Teacher-created quizzes and class results for Kalimaty.
-- Teacher setup is included in the section above.

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

-- ===== Live room modes (v2) =====
-- ============================================================
-- أوضاع الغرف المباشرة: الفصل كله / فرق / مبارزة
-- Requires the base schema from live_setup.sql; this section follows quizzes above.
-- Supabase Dashboard -> SQL Editor -> New query -> الصق -> Run
-- ============================================================

-- 1) أعمدة جديدة
alter table public.live_sessions add column if not exists mode  text not null default 'class';
alter table public.live_sessions add column if not exists teams int  not null default 2;
alter table public.live_players  add column if not exists team  int  not null default 0;
alter table public.live_players  add column if not exists grp   int  not null default 0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_sessions_mode_chk') then
    alter table public.live_sessions add constraint live_sessions_mode_chk check (mode in ('class','teams','duel'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'live_sessions_teams_chk') then
    alter table public.live_sessions add constraint live_sessions_teams_chk check (teams between 2 and 4);
  end if;
end $$;

-- 2) المعلم: إنشاء غرفة بوضع محدد (الاستدعاء القديم live_create(qid) يعمل كما هو = الفصل كله)
drop function if exists public.live_create(uuid);
create or replace function public.live_create(qid uuid, p_mode text default 'class', p_teams int default 2)
returns uuid language plpgsql security definer set search_path = public as $$
declare q record; sid uuid; m text := coalesce(p_mode, 'class'); t int := least(4, greatest(2, coalesce(p_teams, 2)));
begin
  if m not in ('class','teams','duel') then m := 'class'; end if;
  select * into q from public.quizzes where id = qid and teacher_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
  update public.live_sessions set status = 'finished', finished_at = now()
   where quiz_id = qid and status <> 'finished';
  insert into public.live_sessions (quiz_id, teacher_id, class_code, title, total, mode, teams)
  values (qid, auth.uid(), q.class_code, q.title, jsonb_array_length(q.questions), m, t)
  returning id into sid;
  return sid;
end $$;
grant execute on function public.live_create(uuid, text, int) to authenticated;

-- 3) الطالب: دخول الغرفة مع توزيع تلقائي على فريق أو خصم
create or replace function public.live_join(sid uuid)
returns json language plpgsql security definer set search_path = public as $$
declare s public.live_sessions; nm text; me_team int; me_grp int; g int; c int;
begin
  select * into s from public.live_sessions
   where id = sid and class_code = public.my_class_code() and status <> 'finished';
  if not found then raise exception 'closed'; end if;
  select name into nm from public.profiles where id = auth.uid() and coalesce(role, 'student') = 'student';
  if nm is null then raise exception 'not_student'; end if;

  select team, grp into me_team, me_grp from public.live_players
   where session_id = sid and student_id = auth.uid();
  if not found then
    me_team := 0; me_grp := 0;
    if s.mode = 'teams' then
      -- أقل فريق عددًا (عند التساوي الأصغر رقمًا)
      select t.i into me_team
        from generate_series(0, s.teams - 1) t(i)
        left join (select team, count(*) n from public.live_players where session_id = sid group by team) p on p.team = t.i
       order by coalesce(p.n, 0), t.i limit 1;
    elsif s.mode = 'duel' then
      -- أول مبارزة فيها لاعب واحد فقط، وإلا مبارزة جديدة
      select grp into g from public.live_players where session_id = sid
       group by grp having count(*) = 1 order by grp limit 1;
      if g is null then
        select coalesce(max(grp) + 1, 0) into me_grp from public.live_players where session_id = sid;
        me_team := 0;
      else
        me_grp := g; me_team := 1;
      end if;
    end if;
    insert into public.live_players (session_id, student_id, name, team, grp)
    values (sid, auth.uid(), nm, me_team, me_grp);
  else
    update public.live_players set name = nm where session_id = sid and student_id = auth.uid();
  end if;
  return json_build_object('ok', true, 'mode', s.mode, 'team', me_team, 'grp', me_grp);
end $$;

-- 4) الجميع: حالة الغرفة (تشمل الوضع والفريق/المبارزة)
create or replace function public.live_poll(sid uuid)
returns json language plpgsql security definer stable set search_path = public as $$
declare s public.live_sessions; res json;
begin
  select * into s from public.live_sessions where id = sid and class_code = public.my_class_code();
  if not found then return null; end if;
  select json_build_object(
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'status', s.status, 'q', s.q_index, 'phase', s.phase,
    'started', (extract(epoch from s.q_started_at) * 1000)::bigint,
    'limit', s.q_limit, 'total', s.total, 'title', s.title, 'quiz_id', s.quiz_id,
    'mode', s.mode, 'teams', s.teams,
    'players', coalesce((
      select json_agg(x order by x.score desc, x.ms asc, x.name)
        from (
          select p.student_id as id, p.name, p.team, p.grp,
                 coalesce(sum(a.points), 0) as score,
                 count(*) filter (where a.ok) as correct,
                 coalesce(sum(a.ms), 0) as ms,
                 coalesce(bool_or(a.q_index = s.q_index), false) as answered,
                 (select aa.points from public.live_answers aa
                   where aa.session_id = sid and aa.student_id = p.student_id and aa.q_index = s.q_index) as last,
                 (select aa.ok from public.live_answers aa
                   where aa.session_id = sid and aa.student_id = p.student_id and aa.q_index = s.q_index) as last_ok
            from public.live_players p
            left join public.live_answers a on a.session_id = p.session_id and a.student_id = p.student_id
           where p.session_id = sid
           group by p.student_id, p.name, p.team, p.grp
        ) x), '[]'::json)
  ) into res;
  return res;
end $$;

-- 5) قائمة الغرف تعرض الوضع أيضًا
create or replace function public.live_list()
returns json language sql security definer stable set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'id', s.id, 'quiz_id', s.quiz_id, 'title', s.title, 'status', s.status, 'total', s.total,
           'mode', s.mode, 'teams', s.teams,
           'players', (select count(*) from public.live_players p where p.session_id = s.id),
           'plist', coalesce((select json_agg(json_build_object('id', x.student_id, 'name', x.name)) from (select student_id, name from public.live_players p where p.session_id = s.id order by p.student_id limit 12) x), '[]'::json)
         ) order by s.created_at desc), '[]'::json)
    from public.live_sessions s
   where s.class_code = public.my_class_code()
     and s.status <> 'finished'
     and s.created_at > now() - interval '8 hours'
$$;

-- ===== مزامنة لوحة تحكم غرفة الشرح بين أجهزة المعلم =====
create table if not exists public.class_rooms(
  code text primary key, teacher uuid, rid text, title text, slot int default 0, seen timestamptz default now());
alter table public.class_rooms enable row level security;
create table if not exists public.class_room_controls(
  code text primary key references public.class_rooms(code) on delete cascade,
  teacher uuid not null references auth.users(id) on delete cascade,
  version bigint not null default 0,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now());
alter table public.class_room_controls enable row level security;
create or replace function public.cr_live_control_set(p_code text, p_state jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare me uuid := auth.uid(); v jsonb; n bigint;
begin
  if me is null then raise exception 'not_auth'; end if;
  if not exists(select 1 from profiles where id=me and role='teacher' and class_code=p_code) then raise exception 'forbidden'; end if;
  insert into class_room_controls(code,teacher,version,state,updated_at)
    values(p_code,me,1,coalesce(p_state,'{}'::jsonb),now())
    on conflict(code) do update set teacher=me,version=class_room_controls.version+1,state=coalesce(p_state,'{}'::jsonb),updated_at=now()
    returning version,state into n,v;
  return jsonb_build_object('code',p_code,'version',n,'state',v,'updated_at',now());
end $$;
create or replace function public.cr_live_control_get(p_code text)
returns jsonb language sql security definer stable set search_path=public,auth as $$
  select jsonb_build_object('code',c.code,'version',c.version,'state',c.state,'updated_at',c.updated_at)
  from class_room_controls c join profiles p on p.class_code=c.code
  where c.code=p_code and p.id=auth.uid() and p.role='teacher'
$$;
grant execute on function public.cr_live_control_set(text,jsonb), public.cr_live_control_get(text) to authenticated;
