-- ============================================================
-- المسابقات المباشرة (تحدي الصف) — شغّله بعد quiz_setup.sql
-- Supabase Dashboard -> SQL Editor -> New query -> الصق -> Run
-- ============================================================

-- 1) الجداول
create table if not exists public.live_sessions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes(id) on delete cascade,
  teacher_id   uuid not null references auth.users(id) on delete cascade,
  class_code   text not null,
  title        text,
  status       text not null default 'lobby' check (status in ('lobby','running','finished')),
  q_index      int  not null default -1,
  phase        text not null default 'q' check (phase in ('q','reveal')),
  q_started_at timestamptz,
  q_limit      int  not null default 20,
  total        int  not null default 0,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists live_sessions_class_idx on public.live_sessions (class_code, status);

create table if not exists public.live_players (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  joined_at  timestamptz not null default now(),
  primary key (session_id, student_id)
);

create table if not exists public.live_answers (
  session_id  uuid not null references public.live_sessions(id) on delete cascade,
  student_id  uuid not null references auth.users(id) on delete cascade,
  q_index     int  not null,
  ok          boolean not null default false,
  points      numeric not null default 0,
  ms          int  not null default 0,
  answered_at timestamptz not null default now(),
  primary key (session_id, student_id, q_index)
);

-- كل الوصول عبر الدوال أدناه (security definer)، فلا سياسات مباشرة
alter table public.live_sessions enable row level security;
alter table public.live_players  enable row level security;
alter table public.live_answers  enable row level security;

-- 2) زمن السؤال: زمن السؤال نفسه ← الزمن الافتراضي للمسابقة ← 20 ثانية
create or replace function public._live_lim(qz jsonb, st jsonb, idx int)
returns int language sql immutable as $$
  select coalesce(nullif((qz->idx->>'s')::numeric, 0), nullif((st->>'time')::numeric, 0), 20)::int
$$;

create or replace function public._live_set_q(sid uuid, idx int)
returns void language plpgsql security definer set search_path = public as $$
declare qq record;
begin
  select q.questions, q.settings into qq
  from public.live_sessions s join public.quizzes q on q.id = s.quiz_id where s.id = sid;
  update public.live_sessions
     set status = 'running', q_index = idx, phase = 'q',
         q_started_at = clock_timestamp(),
         q_limit = public._live_lim(qq.questions, qq.settings, idx)
   where id = sid;
end $$;

-- 3) المعلم: إنشاء غرفة لمسابقة منشورة
create or replace function public.live_create(qid uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare q record; sid uuid;
begin
  select * into q from public.quizzes where id = qid and teacher_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
  update public.live_sessions set status = 'finished', finished_at = now()
   where quiz_id = qid and status <> 'finished';
  insert into public.live_sessions (quiz_id, teacher_id, class_code, title, total)
  values (qid, auth.uid(), q.class_code, q.title, jsonb_array_length(q.questions))
  returning id into sid;
  return sid;
end $$;

create or replace function public._live_owner(sid uuid)
returns public.live_sessions language plpgsql security definer set search_path = public as $$
declare s public.live_sessions;
begin
  select * into s from public.live_sessions where id = sid and teacher_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
  return s;
end $$;

create or replace function public.live_start(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.live_sessions;
begin
  s := public._live_owner(sid);
  if s.status = 'finished' then raise exception 'finished'; end if;
  if s.total < 1 then raise exception 'empty'; end if;
  perform public._live_set_q(sid, 0);
end $$;

create or replace function public.live_reveal(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._live_owner(sid);
  update public.live_sessions set phase = 'reveal' where id = sid and status = 'running';
end $$;

-- إنهاء المسابقة وحفظ نتائج كل طالب في سجل الاختبارات (quiz_results)
create or replace function public.live_end(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.live_sessions; qq record; maxs numeric;
begin
  s := public._live_owner(sid);
  if s.status = 'finished' then return; end if;
  select questions into qq from public.quizzes where id = s.quiz_id;
  select coalesce(sum(coalesce(nullif((e->>'p')::numeric, 0), 1)), 0) into maxs
    from jsonb_array_elements(qq.questions) e;
  insert into public.quiz_results (quiz_id, student_id, student_name, score, max_score, correct, total, duration_ms, answers, created_at)
  select s.quiz_id, p.student_id, p.name,
         coalesce(sum(a.points), 0), maxs,
         count(*) filter (where a.ok), s.total,
         coalesce(sum(a.ms), 0)::int,
         (select coalesce(jsonb_agg(case when exists (
                   select 1 from public.live_answers z
                    where z.session_id = sid and z.student_id = p.student_id and z.q_index = g and z.ok) then 1 else 0 end order by g), '[]'::jsonb)
            from generate_series(0, greatest(s.total - 1, 0)) g),
         now()
    from public.live_players p
    left join public.live_answers a on a.session_id = p.session_id and a.student_id = p.student_id
   where p.session_id = sid
   group by p.student_id, p.name
  on conflict (quiz_id, student_id) do update
    set student_name = excluded.student_name, score = excluded.score, max_score = excluded.max_score,
        correct = excluded.correct, total = excluded.total, duration_ms = excluded.duration_ms,
        answers = excluded.answers, created_at = now();
  update public.live_sessions set status = 'finished', phase = 'reveal', finished_at = now() where id = sid;
end $$;

create or replace function public.live_next(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.live_sessions;
begin
  s := public._live_owner(sid);
  if s.status <> 'running' then return; end if;
  if s.q_index + 1 < s.total then perform public._live_set_q(sid, s.q_index + 1);
  else perform public.live_end(sid); end if;
end $$;

create or replace function public.live_cancel(sid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._live_owner(sid);
  delete from public.live_sessions where id = sid;
end $$;

-- 4) الطالب والمعلم: قائمة الغرف المفتوحة لفصلي
create or replace function public.live_list()
returns json language sql security definer stable set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'id', s.id, 'quiz_id', s.quiz_id, 'title', s.title, 'status', s.status, 'total', s.total,
           'players', (select count(*) from public.live_players p where p.session_id = s.id)
         ) order by s.created_at desc), '[]'::json)
    from public.live_sessions s
   where s.class_code = public.my_class_code()
     and s.status <> 'finished'
     and s.created_at > now() - interval '8 hours'
$$;

-- الطالب: دخول الغرفة
create or replace function public.live_join(sid uuid)
returns json language plpgsql security definer set search_path = public as $$
declare s public.live_sessions; nm text;
begin
  select * into s from public.live_sessions
   where id = sid and class_code = public.my_class_code() and status <> 'finished';
  if not found then raise exception 'closed'; end if;
  select name into nm from public.profiles where id = auth.uid() and coalesce(role, 'student') = 'student';
  if nm is null then raise exception 'not_student'; end if;
  insert into public.live_players (session_id, student_id, name) values (sid, auth.uid(), nm)
  on conflict (session_id, student_id) do update set name = excluded.name;
  return json_build_object('ok', true);
end $$;

-- الجميع: حالة الغرفة + الترتيب الحي (يُستدعى كل ثانية تقريبًا)
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
    'players', coalesce((
      select json_agg(x order by x.score desc, x.ms asc, x.name)
        from (
          select p.student_id as id, p.name,
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
           group by p.student_id, p.name
        ) x), '[]'::json)
  ) into res;
  return res;
end $$;

-- الطالب: إرسال الإجابة (النقاط ومكافأة السرعة تُحسب هنا بزمن الخادم)
create or replace function public.live_answer(sid uuid, q int, frac numeric)
returns json language plpgsql security definer set search_path = public as $$
declare s public.live_sessions; qq record; raw numeric; el int; p numeric; pts numeric; bonus numeric := 0; f numeric;
begin
  select * into s from public.live_sessions
   where id = sid and class_code = public.my_class_code() and status = 'running';
  if not found or s.q_index <> q or s.phase <> 'q' then
    return json_build_object('ok', false, 'reason', 'closed');
  end if;
  if not exists (select 1 from public.live_players where session_id = sid and student_id = auth.uid()) then
    raise exception 'not_joined';
  end if;
  raw := extract(epoch from clock_timestamp() - s.q_started_at) * 1000;
  if raw > s.q_limit * 1000 + 2000 then return json_build_object('ok', false, 'reason', 'late'); end if;
  select questions, settings into qq from public.quizzes where id = s.quiz_id;
  el := least(s.q_limit * 1000, greatest(0, raw::int));
  p := coalesce(nullif((qq.questions->q->>'p')::numeric, 0), 1);
  f := least(1, greatest(0, coalesce(frac, 0)));
  pts := round(p * f, 2);
  if f >= 1 and coalesce(qq.settings->>'mode', '') = 'speed' then
    bonus := round(p * 0.5 * (s.q_limit * 1000 - el) / (s.q_limit * 1000.0), 2);
  end if;
  insert into public.live_answers (session_id, student_id, q_index, ok, points, ms)
  values (sid, auth.uid(), q, f >= 1, pts + bonus, el)
  on conflict do nothing;
  return json_build_object('ok', true, 'points', pts + bonus);
end $$;

-- 5) الصلاحيات
grant execute on function public.live_create(uuid)           to authenticated;
grant execute on function public.live_start(uuid)            to authenticated;
grant execute on function public.live_reveal(uuid)           to authenticated;
grant execute on function public.live_next(uuid)             to authenticated;
grant execute on function public.live_end(uuid)              to authenticated;
grant execute on function public.live_cancel(uuid)           to authenticated;
grant execute on function public.live_list()                 to authenticated;
grant execute on function public.live_join(uuid)             to authenticated;
grant execute on function public.live_poll(uuid)             to authenticated;
grant execute on function public.live_answer(uuid, int, numeric) to authenticated;
